from __future__ import annotations

import gzip
import json
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any
from uuid import uuid4
from supabase import Client, create_client
from .analytics import derive_flight_metrics
from .config import Settings
from .models import FlightRecord, ParserDiagnostic
from .parsers import downsample_telemetry_for_replay, generate_flight_events, generate_flight_tags


class Repository:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client: Client | None = None
        self._client_error: str | None = None
        self.memory_flights: dict[str, FlightRecord] = {}
        self.memory_model_runs: list[dict[str, Any]] = []
        self.memory_uploads: dict[str, dict[str, Any]] = {}

    @property
    def configured(self) -> bool:
        return self.settings.supabase_configured

    @property
    def client(self) -> Client | None:
        if not self.configured:
            return None
        if self._client_error:
            return None
        if self._client is None:
            try:
                self._client = create_client(self.settings.supabase_url, self.settings.supabase_service_role_key)
            except Exception as exc:
                self._client_error = _safe_error(exc)
                return None
        return self._client

    def save_raw_file(self, filename: str, content: bytes) -> str | None:
        if not self.client:
            return None
        path = f"raw/{datetime.now(timezone.utc).date()}/{uuid4()}-{_safe_name(filename)}"
        self.client.storage.from_(self.settings.supabase_storage_bucket).upload(path, content)
        return path

    def delete_raw_file(self, path: str | None) -> None:
        if path and self.client:
            self.client.storage.from_(self.settings.supabase_storage_bucket).remove([path])

    def delete_normalized_file(self, path: str | None) -> None:
        if path and self.client:
            self.client.storage.from_(self.settings.supabase_storage_bucket).remove([path])

    def claim_upload(self, content_sha256: str, source_filename: str) -> dict[str, Any]:
        if not self.client:
            existing = self.memory_uploads.get(content_sha256)
            if existing:
                raise DuplicateUploadError(existing)
            row = {
                "id": str(uuid4()),
                "content_sha256": content_sha256,
                "source_filename": source_filename,
                "status": "processing",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.memory_uploads[content_sha256] = row
            return row
        existing = self.client.table("flight_uploads").select("id,source_filename,status,created_at").eq("content_sha256", content_sha256).limit(1).execute()
        if existing.data:
            existing_upload = existing.data[0]
            if existing_upload.get("status") == "processing" and _is_stale_upload(existing_upload.get("created_at")):
                self.client.table("flight_uploads").delete().eq("id", existing_upload["id"]).execute()
            else:
                raise DuplicateUploadError(existing_upload)
        try:
            response = self.client.table("flight_uploads").insert({
                "content_sha256": content_sha256,
                "source_filename": source_filename,
                "status": "processing",
            }).execute()
        except Exception as exc:
            if "23505" in str(exc) or "duplicate key" in str(exc).lower():
                raced = self.client.table("flight_uploads").select("id,source_filename,status,created_at").eq("content_sha256", content_sha256).limit(1).execute()
                raise DuplicateUploadError((raced.data or [{}])[0]) from exc
            raise
        return response.data[0]

    def complete_upload(self, upload_id: str, raw_file_path: str | None) -> None:
        if not self.client:
            for upload in self.memory_uploads.values():
                if upload.get("id") == upload_id:
                    upload.update({"status": "completed", "raw_file_path": raw_file_path, "completed_at": datetime.now(timezone.utc).isoformat()})
                    return
            return
        self.client.table("flight_uploads").update({
            "status": "completed",
            "raw_file_path": raw_file_path,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", upload_id).execute()

    def release_upload(self, upload_id: str, content_sha256: str) -> None:
        self.memory_uploads.pop(content_sha256, None)
        if self.client:
            self.client.table("flight_uploads").delete().eq("id", upload_id).execute()

    def backfill_upload_hashes(self) -> int:
        if not self.client:
            return 0
        response = self.client.table("flights").select("id,source_filename,raw_file_path,upload_id").is_("upload_id", "null").limit(250).execute()
        rows = response.data or []
        paths: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            path = row.get("raw_file_path")
            if path:
                paths.setdefault(path, []).append(row)
        completed = 0
        for path, linked_rows in paths.items():
            try:
                content = self.client.storage.from_(self.settings.supabase_storage_bucket).download(path)
                digest = sha256(content).hexdigest()
                existing = self.client.table("flight_uploads").select("id").eq("content_sha256", digest).limit(1).execute()
                if existing.data:
                    upload_id = existing.data[0]["id"]
                else:
                    registry = self.client.table("flight_uploads").insert({
                        "content_sha256": digest,
                        "source_filename": linked_rows[0].get("source_filename") or "legacy upload",
                        "raw_file_path": path,
                        "status": "completed",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }).execute()
                    upload_id = registry.data[0]["id"]
                self.client.table("flights").update({"upload_id": upload_id}).eq("raw_file_path", path).execute()
                completed += 1
            except Exception:
                continue
        return completed

    def save_normalized_file(self, flight: FlightRecord) -> str | None:
        payload = json.dumps([point.model_dump(mode="json") for point in flight.telemetry]).encode("utf-8")
        compressed = gzip.compress(payload)
        if not self.client:
            return None
        path = f"normalized/{flight.id}.json.gz"
        self.client.storage.from_(self.settings.supabase_storage_bucket).upload(path, compressed)
        return path

    def save_model_artifact(self, name: str, content: bytes) -> str | None:
        if not self.client:
            return None
        path = f"models/{datetime.now(timezone.utc).date()}/{uuid4()}-{_safe_name(name)}.joblib"
        self.client.storage.from_(self.settings.model_artifact_bucket).upload(
            path,
            content,
            {"content-type": "application/octet-stream"},
        )
        return path

    def persist_flight(self, flight: FlightRecord, raw_file_path: str | None = None, upload_id: str | None = None) -> FlightRecord:
        flight.rawFilePath = raw_file_path
        if not flight.id:
            flight.id = str(uuid4())
        normalized_path = self.save_normalized_file(flight)
        flight.normalizedFilePath = normalized_path
        if not self.client:
            self.memory_flights[flight.id] = flight
            return flight
        row = {
            "id": flight.id,
            "upload_id": upload_id,
            "name": flight.name,
            "source_filename": flight.sourceFilename,
            "source_type": flight.sourceType,
            "raw_file_path": raw_file_path,
            "normalized_file_path": normalized_path,
            "location_name": flight.locationName,
            "takeoff_latitude": flight.telemetry[0].latitude if flight.telemetry else None,
            "takeoff_longitude": flight.telemetry[0].longitude if flight.telemetry else None,
            "started_at": flight.startedAt.isoformat() if flight.startedAt else None,
            "ended_at": flight.endedAt.isoformat() if flight.endedAt else None,
            "duration_seconds": flight.metrics.durationSeconds,
            "total_distance_meters": flight.metrics.totalDistanceMeters,
            "battery_used_percent": flight.metrics.batteryUsedPercent,
            "max_altitude_meters": flight.metrics.maxAltitudeMeters,
            "average_speed_mps": flight.metrics.averageSpeedMps,
            "max_speed_mps": flight.metrics.maxSpeedMps,
            "telemetry_point_count": len(flight.telemetry),
            "parser_confidence": flight.parserConfidence,
            "status": flight.status,
        }
        self.client.table("flights").upsert(row).execute()
        self.client.table("flight_metrics").insert(_metrics_row(flight)).execute()
        downsample_rows = [_telemetry_row(flight.id, point, True) for point in flight.downsampledTelemetry]
        if downsample_rows:
            self.client.table("telemetry_points").insert(downsample_rows).execute()
        self.memory_flights[flight.id] = flight
        return flight

    def persist_diagnostics(self, diagnostics: list[ParserDiagnostic], flight_id: str | None = None) -> None:
        if not self.client:
            return
        rows = [
            {
                "flight_id": flight_id,
                "source_filename": diagnostic.sourceFilename,
                "parser_name": diagnostic.parserName,
                "status": diagnostic.status,
                "confidence": diagnostic.confidence,
                "missing_fields": diagnostic.missingFields,
                "warnings": diagnostic.warnings,
            }
            for diagnostic in diagnostics
        ]
        if rows:
            self.client.table("parser_diagnostics").insert(rows).execute()

    def list_flights(self) -> list[dict[str, Any]]:
        if not self.client:
            return [flight.model_dump(mode="json") for flight in self.memory_flights.values()]
        response = self.client.table("flights").select("*").order("created_at", desc=True).execute()
        return response.data or []

    def get_flight(self, flight_id: str) -> FlightRecord | None:
        if flight_id in self.memory_flights:
            return self.memory_flights[flight_id]
        if not self.client:
            return None
        response = self.client.table("flights").select("*").eq("id", flight_id).limit(1).execute()
        if not response.data:
            return None
        flight = self._hydrate_flight(response.data[0])
        if flight:
            self.memory_flights[flight_id] = flight
        return flight

    def load_full_flights(self) -> list[FlightRecord]:
        if not self.client:
            return list(self.memory_flights.values())
        hydrated: list[FlightRecord] = []
        for row in self.list_flights():
            flight_id = row.get("id")
            if flight_id:
                flight = self.get_flight(flight_id)
                if flight:
                    hydrated.append(flight)
        return hydrated

    def delete_flight(self, flight_id: str) -> None:
        self.memory_flights.pop(flight_id, None)
        if self.client:
            self.client.table("flights").delete().eq("id", flight_id).execute()

    def save_model_run(self, row: dict[str, Any]) -> dict[str, Any]:
        row.setdefault("id", str(uuid4()))
        if not self.client:
            self.memory_model_runs.insert(0, row)
            return row
        self.client.table("model_runs").insert(row).execute()
        return row

    def list_model_runs(self) -> list[dict[str, Any]]:
        if not self.client:
            return self.memory_model_runs
        response = self.client.table("model_runs").select("*").order("created_at", desc=True).limit(20).execute()
        return response.data or []

    def diagnostics(self) -> dict[str, Any]:
        report: dict[str, Any] = {
            "configured": self.configured,
            "tables": {},
            "storageBuckets": {},
        }
        if not self.client:
            if self._client_error:
                report["error"] = self._client_error
                return report
            report["error"] = "Supabase environment variables are not configured."
            return report
        for table in [
            "flight_uploads",
            "flights",
            "telemetry_points",
            "flight_metrics",
            "weather_snapshots",
            "feature_vectors",
            "model_runs",
            "predictions",
            "parser_diagnostics",
            "weather_cache",
        ]:
            try:
                response = self.client.table(table).select("id", count="exact").limit(1).execute()
                report["tables"][table] = {"ok": True, "sampleRows": len(response.data or [])}
            except Exception as exc:
                report["tables"][table] = {"ok": False, "error": _safe_error(exc)}
        for bucket in [self.settings.supabase_storage_bucket, self.settings.model_artifact_bucket]:
            try:
                self.client.storage.from_(bucket).list("", {"limit": 1})
                report["storageBuckets"][bucket] = {"ok": True}
            except Exception as exc:
                report["storageBuckets"][bucket] = {"ok": False, "error": _safe_error(exc)}
        report["ok"] = all(item["ok"] for item in report["tables"].values()) and all(item["ok"] for item in report["storageBuckets"].values())
        return report

    def save_prediction(self, row: dict[str, Any]) -> dict[str, Any]:
        row.setdefault("id", str(uuid4()))
        if self.client:
            self.client.table("predictions").insert(row).execute()
        return row

    def save_weather_cache(self, row: dict[str, Any]) -> None:
        if self.client:
            self.client.table("weather_cache").upsert(row, on_conflict="cache_key").execute()

    def get_weather_cache(self, cache_key: str) -> dict[str, Any] | None:
        if not self.client:
            return None
        response = self.client.table("weather_cache").select("*").eq("cache_key", cache_key).limit(1).execute()
        return response.data[0] if response.data else None

    def _hydrate_flight(self, row: dict[str, Any]) -> FlightRecord | None:
        path = row.get("normalized_file_path")
        if not path or not self.client:
            return None
        try:
            downloaded = self.client.storage.from_(self.settings.supabase_storage_bucket).download(path)
            content = gzip.decompress(downloaded)
            telemetry_payload = json.loads(content.decode("utf-8"))
            from .models import TelemetryPoint

            telemetry = [TelemetryPoint(**point) for point in telemetry_payload]
            metrics = derive_flight_metrics(telemetry)
            return FlightRecord(
                id=row["id"],
                name=row.get("name") or "Imported flight",
                sourceFilename=row.get("source_filename") or "unknown",
                sourceType=row.get("source_type") or "unknown",
                rawFilePath=row.get("raw_file_path"),
                normalizedFilePath=path,
                locationName=row.get("location_name"),
                startedAt=telemetry[0].timestamp if telemetry else None,
                endedAt=telemetry[-1].timestamp if telemetry else None,
                parserConfidence=row.get("parser_confidence") or 0,
                status=row.get("status") or "parsed",
                telemetry=telemetry,
                downsampledTelemetry=downsample_telemetry_for_replay(telemetry),
                metrics=metrics,
                events=generate_flight_events(telemetry),
                tags=generate_flight_tags(metrics),
                featureAvailability={
                    "mapPath": bool(telemetry),
                    "replay": bool(telemetry),
                    "batteryAnalytics": any(point.batteryPercent is not None for point in telemetry),
                    "altitudeChart": any(point.altitudeMeters is not None for point in telemetry),
                    "speedChart": any(point.speedMps is not None for point in telemetry),
                    "signalStability": any(point.gpsSatellites is not None or point.signalStrengthPercent is not None for point in telemetry),
                    "weatherJoin": bool(telemetry),
                },
            )
        except Exception:
            return None


def _safe_name(filename: str) -> str:
    return "".join(ch for ch in filename if ch.isalnum() or ch in ("-", "_", "."))[:120]


class DuplicateUploadError(Exception):
    def __init__(self, existing: dict[str, Any]):
        self.existing = existing
        super().__init__("This exact source file has already been uploaded.")


def _is_stale_upload(created_at: str | None) -> bool:
    if not created_at:
        return False
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    return datetime.now(timezone.utc) - created > timedelta(minutes=15)


def _safe_error(exc: Exception) -> str:
    text = str(exc)
    for marker in ("sb_secret_", "eyJ"):
        if marker in text:
            text = text.split(marker)[0] + "[redacted]"
    return text[:500]


def _metrics_row(flight: FlightRecord) -> dict[str, Any]:
    m = flight.metrics
    return {
        "flight_id": flight.id,
        "hover_ratio": m.hoverRatio,
        "altitude_gain_meters": m.altitudeGainMeters,
        "battery_drain_per_minute": m.batteryDrainPerMinute,
        "battery_drain_per_100m": m.batteryDrainPer100m,
        "route_efficiency": m.routeEfficiency,
        "aggressive_movement_score": m.aggressiveMovementScore,
        "signal_stability_score": m.signalStabilityScore,
        "return_margin_score": m.returnMarginScore,
        "wind_impact_score": m.windImpactScore,
        "feature_completeness_score": m.featureCompletenessScore,
    }


def _telemetry_row(flight_id: str | None, point, is_downsampled: bool) -> dict[str, Any]:
    return {
        "flight_id": flight_id,
        "timestamp": point.timestamp.isoformat(),
        "latitude": point.latitude,
        "longitude": point.longitude,
        "altitude_meters": point.altitudeMeters,
        "speed_mps": point.speedMps,
        "battery_percent": point.batteryPercent,
        "distance_from_home_meters": point.distanceFromHomeMeters,
        "heading_degrees": point.headingDegrees,
        "vertical_speed_mps": point.verticalSpeedMps,
        "gps_satellites": point.gpsSatellites,
        "signal_strength_percent": point.signalStrengthPercent,
        "event_type": point.eventType,
        "is_downsampled": is_downsampled,
    }
