from __future__ import annotations

from hashlib import sha256
from typing import Any
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from .analytics import derive_flight_metrics
from .config import Settings, get_settings
from .features import build_segment_vectors, extract_flight_feature_vector
from .ml import ARTIFACTS, build_datasets, detect_anomalies, predict_battery, predict_risk, rank_flight_windows, train_all_models, train_anomaly_model, train_battery_model, train_risk_model
from .models import PredictionRequest, TrainRequest
from .parsers import parse_dji_flightrecords_zip, parse_flight_json, parse_uploaded_flight_file
from .repository import DuplicateUploadError, Repository
from .security import enforce_rate_limit, validate_file_size, validate_upload_file
from .weather import get_forecast_windows, get_historical_weather_for_flight, get_weather_provider_status, join_weather_to_telemetry, summarize_weather_impact

settings = get_settings()
repo = Repository(settings)

app = FastAPI(
    title="AeroStats AI Backend",
    description="Secure upload-first drone telemetry parsing, Supabase persistence, weather joining, and scikit-learn ML.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


@app.on_event("startup")
def backfill_legacy_upload_hashes() -> None:
    repo.backfill_upload_hashes()


async def guard(request: Request, app_settings: Settings = Depends(get_settings)) -> Settings:
    await enforce_rate_limit(request, app_settings)
    return app_settings


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "aerostats-ai-backend",
        "supabaseConfigured": settings.supabase_configured,
        "storageStrategy": "raw and normalized files in Supabase Storage; downsampled telemetry and summaries in Postgres",
        "coldStartNote": "Render free services can sleep; frontend should show Backend waking up while this endpoint responds.",
    }


@app.get("/health/deep")
def deep_health() -> dict[str, Any]:
    diagnostics = repo.diagnostics()
    return {
        "ok": bool(diagnostics.get("ok")),
        "service": "aerostats-ai-backend",
        "supabaseConfigured": settings.supabase_configured,
        "diagnostics": diagnostics,
    }


@app.get("/model/status")
def model_status() -> dict[str, Any]:
    diagnostics = repo.diagnostics()
    return {
        "backend": "ready",
        "supabaseConfigured": settings.supabase_configured,
        "supabaseReady": bool(diagnostics.get("ok")),
        "supabaseDiagnostics": diagnostics,
        "modelArtifactStorage": settings.model_artifact_bucket,
        "latestModelRuns": repo.list_model_runs() if diagnostics.get("ok") else [],
        "loadedArtifacts": list(ARTIFACTS.keys()),
        "honestyNote": "High confidence is only returned when multiple flights, enough segment rows, strong feature completeness, validation metrics, and narrow intervals support it.",
    }


@app.post("/upload/flight")
async def upload_flight(
    request: Request,
    file: UploadFile = File(...),
    normalizedTelemetry: str | None = Form(default=None),
    app_settings: Settings = Depends(guard),
) -> dict[str, Any]:
    extension = validate_upload_file(file, app_settings)
    content = await file.read()
    validate_file_size(content, app_settings)
    content_sha256 = sha256(content).hexdigest()
    if normalizedTelemetry:
        normalized_content = normalizedTelemetry.encode("utf-8")
        validate_file_size(normalized_content, app_settings)
        result = parse_flight_json(file.filename or "upload", normalizedTelemetry)
        for diagnostic in result.diagnostics:
            diagnostic.parserName = "dji-log-parser-js"
            diagnostic.warnings.append("DJI source decoded locally in the browser; original source file retained privately.")
    else:
        result = parse_uploaded_flight_file(file.filename or "upload", content)
    if not result.flights:
        return {"ok": True, "fileType": extension, "parser": result.model_dump(mode="json"), "flights": []}
    try:
        upload = repo.claim_upload(content_sha256, file.filename or "upload")
    except DuplicateUploadError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_upload",
                "message": "This exact flight file has already been uploaded. It was rejected to protect dashboard totals and ML training data.",
                "originalFilename": exc.existing.get("source_filename"),
                "uploadedAt": exc.existing.get("created_at"),
            },
        ) from exc
    raw_path = None
    persisted = []
    try:
        raw_path = repo.save_raw_file(file.filename or "upload", content)
        for flight in result.flights:
            persisted.append(repo.persist_flight(flight, raw_path, upload["id"]).model_dump(mode="json"))
        for flight in result.flights:
            repo.persist_diagnostics(result.diagnostics, flight.id)
        repo.complete_upload(upload["id"], raw_path)
    except Exception:
        for flight in result.flights:
            try:
                repo.delete_normalized_file(flight.normalizedFilePath)
            except Exception:
                pass
        try:
            repo.delete_raw_file(raw_path)
        except Exception:
            pass
        try:
            repo.release_upload(upload["id"], content_sha256)
        except Exception:
            pass
        raise
    return {"ok": True, "fileType": extension, "parser": result.model_dump(mode="json"), "flights": persisted}


@app.post("/parse/file")
async def parse_file(request: Request, file: UploadFile = File(...), app_settings: Settings = Depends(guard)) -> dict[str, Any]:
    validate_upload_file(file, app_settings)
    content = await file.read()
    validate_file_size(content, app_settings)
    return {"ok": True, "parser": parse_uploaded_flight_file(file.filename or "upload", content).model_dump(mode="json")}


@app.post("/parse/dji-flightrecords-zip")
async def parse_dji_zip(request: Request, file: UploadFile = File(...), app_settings: Settings = Depends(guard)) -> dict[str, Any]:
    validate_upload_file(file, app_settings)
    content = await file.read()
    validate_file_size(content, app_settings)
    return {"ok": True, "parser": parse_dji_flightrecords_zip(file.filename or "FlightRecords.zip", content).model_dump(mode="json")}


@app.get("/flights")
def flights() -> dict[str, Any]:
    return {"ok": True, "flights": repo.list_flights()}


@app.get("/flights/{flight_id}")
def flight_detail(flight_id: str) -> dict[str, Any]:
    flight = repo.get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found in active backend cache. Re-upload or load from Supabase storage in a persistent deployment.")
    return {"ok": True, "flight": flight.model_dump(mode="json")}


@app.delete("/flights/{flight_id}")
def delete_flight(flight_id: str) -> dict[str, Any]:
    repo.delete_flight(flight_id)
    return {"ok": True, "deleted": flight_id}


@app.get("/flights/{flight_id}/telemetry")
def telemetry(flight_id: str) -> dict[str, Any]:
    flight = repo.get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return {"ok": True, "telemetry": [point.model_dump(mode="json") for point in flight.telemetry]}


@app.get("/flights/{flight_id}/telemetry/downsampled")
def downsampled_telemetry(flight_id: str) -> dict[str, Any]:
    flight = repo.get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return {"ok": True, "telemetry": [point.model_dump(mode="json") for point in flight.downsampledTelemetry]}


@app.post("/features/extract/{flight_id}")
def extract_features(flight_id: str) -> dict[str, Any]:
    flight = repo.get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return {"ok": True, "flightFeatures": extract_flight_feature_vector(flight), "segmentFeatures": build_segment_vectors(flight)}


@app.get("/features/{flight_id}")
def get_features(flight_id: str) -> dict[str, Any]:
    return extract_features(flight_id)


@app.post("/features/build-dataset")
def build_dataset() -> dict[str, Any]:
    flights = repo.load_full_flights()
    return {"ok": True, "dataset": build_datasets(flights)}


@app.post("/weather/join/{flight_id}")
async def weather_join(flight_id: str, app_settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    flight = repo.get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    snapshots = await get_historical_weather_for_flight(flight, repo, app_settings)
    joined = join_weather_to_telemetry(flight, snapshots)
    joined.metrics = derive_flight_metrics(joined.telemetry)
    repo.memory_flights[flight_id] = joined
    return {"ok": True, "weatherPoints": len(snapshots), "summary": summarize_weather_impact(joined), "flight": joined.model_dump(mode="json"), "attribution": "Weather data provided by Open-Meteo."}


@app.get("/weather/forecast")
async def weather_forecast(lat: float = Query(...), lon: float = Query(...), app_settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    return {"ok": True, "windows": await get_forecast_windows(lat, lon, repo, app_settings), "attribution": "Weather data provided by Open-Meteo."}


@app.get("/weather/status")
def weather_status() -> dict[str, Any]:
    return {"ok": True, "status": get_weather_provider_status(settings)}


@app.post("/ml/train")
def ml_train(request: TrainRequest) -> dict[str, Any]:
    flights = repo.load_full_flights()
    if request.model == "all":
        return {"ok": True, "runs": train_all_models(flights, repo, request.maxRows)}
    datasets = build_datasets(flights)
    if request.model == "battery":
        return {"ok": True, "run": train_battery_model(datasets["flight_rows"], datasets["segment_rows"], repo, request.maxRows)}
    if request.model == "risk":
        return {"ok": True, "run": train_risk_model(datasets["flight_rows"], repo)}
    return {"ok": True, "run": train_anomaly_model(datasets["segment_rows"], repo, request.maxRows)}


@app.post("/ml/train/battery")
def ml_train_battery() -> dict[str, Any]:
    datasets = build_datasets(repo.load_full_flights())
    return {"ok": True, "run": train_battery_model(datasets["flight_rows"], datasets["segment_rows"], repo)}


@app.post("/ml/train/risk")
def ml_train_risk() -> dict[str, Any]:
    datasets = build_datasets(repo.load_full_flights())
    return {"ok": True, "run": train_risk_model(datasets["flight_rows"], repo)}


@app.post("/ml/train/anomaly")
def ml_train_anomaly() -> dict[str, Any]:
    datasets = build_datasets(repo.load_full_flights())
    return {"ok": True, "run": train_anomaly_model(datasets["segment_rows"], repo)}


@app.post("/ml/predict/battery")
def ml_predict_battery(payload: PredictionRequest) -> dict[str, Any]:
    return {"ok": True, "prediction": predict_battery(payload.features, repo)}


@app.post("/ml/predict/risk")
def ml_predict_risk(payload: PredictionRequest) -> dict[str, Any]:
    return {"ok": True, "prediction": predict_risk(payload.features, repo)}


@app.post("/ml/anomalies/{flight_id}")
def ml_anomalies(flight_id: str) -> dict[str, Any]:
    flight = repo.get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return {"ok": True, "anomalies": detect_anomalies(flight)}


@app.post("/ml/rank-flight-windows")
def ml_rank_flight_windows(payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "windows": rank_flight_windows(payload.get("weatherWindows", []), payload.get("userFlightProfile", {}), repo)}


@app.get("/ml/model-runs")
def ml_model_runs() -> dict[str, Any]:
    return {"ok": True, "modelRuns": repo.list_model_runs()}


@app.get("/ml/model-runs/{model_run_id}")
def ml_model_run(model_run_id: str) -> dict[str, Any]:
    run = next((item for item in repo.list_model_runs() if item.get("id") == model_run_id), None)
    if not run:
        raise HTTPException(status_code=404, detail="Model run not found")
    return {"ok": True, "modelRun": run}


@app.get("/ml/explain/{prediction_id}")
def ml_explain(prediction_id: str) -> dict[str, Any]:
    return {"ok": True, "predictionId": prediction_id, "explanation": "Prediction explanations are stored in predictions.explanation_json when predictions are created."}


@app.get("/ml/confidence-report")
def ml_confidence_report() -> dict[str, Any]:
    runs = repo.list_model_runs()
    return {"ok": True, "confidence": [run.get("confidence_json", {}) for run in runs], "rule": "High requires multiple flights, enough segment rows, validation support, strong feature completeness, and narrow uncertainty."}
