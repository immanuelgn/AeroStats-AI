from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, ExtraTreesRegressor, IsolationForest, RandomForestClassifier, RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score, mean_absolute_error, median_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, LeaveOneGroupOut, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from .features import FEATURE_COLUMNS, build_segment_vectors, extract_flight_feature_vector, weak_risk_label
from .models import FlightRecord
from .repository import Repository

ARTIFACTS: dict[str, Any] = {}


def build_datasets(flights: list[FlightRecord]) -> dict[str, Any]:
    flight_rows = [extract_flight_feature_vector(flight) for flight in flights]
    segment_rows = [row for flight in flights for row in build_segment_vectors(flight)]
    return {"flight_rows": flight_rows, "segment_rows": segment_rows}


def train_all_models(flights: list[FlightRecord], repo: Repository, max_rows: int = 5000) -> dict[str, Any]:
    datasets = build_datasets(flights)
    results = {
        "battery": train_battery_model(datasets["flight_rows"], datasets["segment_rows"], repo, max_rows),
        "risk": train_risk_model(datasets["flight_rows"], repo),
        "anomaly": train_anomaly_model(datasets["segment_rows"], repo, max_rows),
    }
    return results


def train_battery_model(flight_rows: list[dict[str, Any]], segment_rows: list[dict[str, Any]], repo: Repository, max_rows: int = 5000) -> dict[str, Any]:
    rows = _battery_training_rows(flight_rows, segment_rows)[:max_rows]
    if len(rows) < 3:
        return _not_available("battery_drain_regressor", "Need at least 3 labeled flight/segment rows with battery data.")
    df = pd.DataFrame(rows)
    feature_cols = _available_feature_columns(df, FEATURE_COLUMNS)
    X = df[feature_cols]
    y = df["target"]
    groups = df["flight_id"].fillna("unknown")
    candidates = {
        "ridge": Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler()), ("model", Ridge(alpha=1.0))]),
        "random_forest": Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", RandomForestRegressor(n_estimators=80, max_depth=8, random_state=7))]),
        "extra_trees": Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", ExtraTreesRegressor(n_estimators=120, max_depth=10, random_state=7))]),
    }
    if len(rows) >= 80:
        candidates["hist_gradient_boosting"] = Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", HistGradientBoostingRegressor(max_iter=80, random_state=7))])
    split = _validation_split(X, y, groups)
    best = None
    for name, model in candidates.items():
        fitted, metrics = _fit_regressor(name, model, X, y, split)
        if not best or metrics["mae"] < best["metrics"]["mae"]:
            best = {"name": name, "model": fitted, "metrics": metrics}
    confidence = confidence_report(len(set(groups)), len(rows), float(df.get("feature_completeness_score", pd.Series([40])).mean()), best["metrics"])
    train_ranges = _ranges(X)
    artifact_path = _save_artifact(repo, "battery", best["model"], feature_cols, train_ranges)
    run = _model_run("Battery Drain Regressor", best["name"], "battery_used_percent", len(rows), len(set(groups)), split["strategy"], best["metrics"], _feature_importance(best["model"], feature_cols), confidence, artifact_path)
    repo.save_model_run(run)
    ARTIFACTS["battery"] = {"model": best["model"], "features": feature_cols, "run": run, "train_ranges": train_ranges}
    return run


def train_risk_model(flight_rows: list[dict[str, Any]], repo: Repository) -> dict[str, Any]:
    rows = [row for row in flight_rows if row.get("weak_risk_label")]
    if len(rows) < 3:
        return _not_available("flight_risk_classifier", "Need at least 3 flights before weakly supervised risk validation is meaningful.")
    df = pd.DataFrame(rows)
    feature_cols = _available_feature_columns(df, FEATURE_COLUMNS)
    X = df[feature_cols]
    y = df["weak_risk_label"]
    candidates = {
        "logistic_regression": Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler()), ("model", LogisticRegression(max_iter=500, class_weight="balanced"))]),
        "random_forest": Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", RandomForestClassifier(n_estimators=80, max_depth=8, class_weight="balanced", random_state=7))]),
        "extra_trees": Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", ExtraTreesClassifier(n_estimators=120, max_depth=10, class_weight="balanced", random_state=7))]),
    }
    stratify = y if len(set(y)) > 1 and min(y.value_counts()) > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=max(1, int(len(df) * 0.3)), random_state=7, stratify=stratify)
    best = None
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        metrics = {
            "accuracy": float(accuracy_score(y_test, pred)),
            "balanced_accuracy": float(balanced_accuracy_score(y_test, pred)),
            "f1_macro": float(f1_score(y_test, pred, average="macro")),
            "confusion_matrix": confusion_matrix(y_test, pred, labels=["Low", "Medium", "High"]).tolist(),
            "labeling": "weakly supervised",
        }
        if not best or metrics["f1_macro"] > best["metrics"]["f1_macro"]:
            best = {"name": name, "model": model, "metrics": metrics}
    confidence = confidence_report(len(rows), len(rows), float(df.get("feature_completeness_score", pd.Series([40])).mean()), best["metrics"], weak_labels=True)
    train_ranges = _ranges(X)
    artifact_path = _save_artifact(repo, "risk", best["model"], feature_cols, train_ranges)
    run = _model_run("Flight Risk Classifier", best["name"], "weak_risk_label", len(rows), len(rows), "holdout weak labels", best["metrics"], _feature_importance(best["model"], feature_cols), confidence, artifact_path, "Weakly supervised until human risk labels exist.")
    repo.save_model_run(run)
    ARTIFACTS["risk"] = {"model": best["model"], "features": feature_cols, "run": run, "train_ranges": train_ranges}
    return run


def train_anomaly_model(segment_rows: list[dict[str, Any]], repo: Repository, max_rows: int = 5000) -> dict[str, Any]:
    rows = segment_rows[:max_rows]
    if len(rows) < 10:
        return _not_available("anomaly_detector", "Need at least 10 segment rows for IsolationForest.")
    df = pd.DataFrame(rows)
    feature_cols = _available_feature_columns(
        df,
        ["segment_duration", "segment_distance", "altitude_delta", "average_speed", "max_speed", "speed_variance", "acceleration_proxy", "battery_delta", "distance_from_home", "gps_satellites", "signal_strength", "wind_speed", "wind_gust"],
    )
    model = Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", IsolationForest(n_estimators=100, contamination="auto", random_state=7))])
    model.fit(df[feature_cols])
    scores = model.named_steps["model"].decision_function(model.named_steps["imputer"].transform(df[feature_cols]))
    metrics = {"training_score_mean": float(np.mean(scores)), "training_score_std": float(np.std(scores)), "algorithm": "IsolationForest"}
    confidence = confidence_report(len(set(df["flight_id"])), len(rows), float(df.get("feature_completeness_score", pd.Series([40])).mean()), metrics)
    train_ranges = _ranges(df[feature_cols])
    artifact_path = _save_artifact(repo, "anomaly", model, feature_cols, train_ranges)
    run = _model_run("Anomaly Detector", "isolation_forest", "segment_outlier_score", len(rows), len(set(df["flight_id"])), "unsupervised segment fit", metrics, [], confidence, artifact_path)
    repo.save_model_run(run)
    ARTIFACTS["anomaly"] = {"model": model, "features": feature_cols, "run": run, "train_ranges": train_ranges}
    return run


def restore_model_artifacts(repo: Repository) -> dict[str, str]:
    restored: dict[str, str] = {}
    for run in repo.list_model_runs():
        key = _artifact_key(run)
        path = run.get("artifact_path")
        if not key or key in restored or not path:
            continue
        try:
            content = repo.load_model_artifact(path)
            if not content:
                continue
            payload = joblib.load(io.BytesIO(content))
            ARTIFACTS[key] = {
                "model": payload["model"],
                "features": payload["features"],
                "run": run,
                "train_ranges": payload.get("train_ranges", {}),
            }
            restored[key] = path
        except Exception:
            continue
    return restored


def predict_battery(features: dict[str, Any], repo: Repository) -> dict[str, Any]:
    artifact = ARTIFACTS.get("battery")
    if not artifact:
        return {"available": False, "confidence": "Not available", "reason": "Train the battery model first."}
    X = pd.DataFrame([{col: features.get(col) for col in artifact["features"]}])
    prediction = float(artifact["model"].predict(X)[0])
    interval = _prediction_interval(artifact["model"], X, prediction)
    confidence = _prediction_confidence(features, artifact)
    output = {"predictedBatteryUsePercent": prediction, "lowerBound": interval[0], "upperBound": interval[1], "confidence": confidence["label"], "confidenceReasons": confidence["reasons"], "outOfDistribution": confidence["outOfDistribution"]}
    repo.save_prediction({"prediction_type": "battery", "input_json": features, "output_json": output, "explanation_json": {"model": artifact["run"]["model_type"]}, "confidence_label": output["confidence"], "uncertainty_json": {"lower": interval[0], "upper": interval[1]}})
    return output


def predict_risk(features: dict[str, Any], repo: Repository) -> dict[str, Any]:
    artifact = ARTIFACTS.get("risk")
    if not artifact:
        return {"available": False, "confidence": "Not available", "reason": "Train the risk model first."}
    X = pd.DataFrame([{col: features.get(col) for col in artifact["features"]}])
    label = str(artifact["model"].predict(X)[0])
    confidence = _prediction_confidence(features, artifact)
    output = {"riskClass": label, "confidence": confidence["label"], "confidenceReasons": confidence["reasons"], "outOfDistribution": confidence["outOfDistribution"], "labeling": "weakly supervised"}
    repo.save_prediction({"prediction_type": "risk", "input_json": features, "output_json": output, "explanation_json": {"weakLabelRules": ["high wind/gusts", "low return margin", "low signal/GPS", "unusual battery drain", "far distance from home", "high speed variation"]}, "confidence_label": output["confidence"], "uncertainty_json": {}})
    return output


def detect_anomalies(flight: FlightRecord) -> list[dict[str, Any]]:
    artifact = ARTIFACTS.get("anomaly")
    rows = build_segment_vectors(flight)
    if not artifact or not rows:
        return []
    df = pd.DataFrame(rows)
    X = df[[col for col in artifact["features"] if col in df.columns]]
    labels = artifact["model"].predict(X)
    scores = artifact["model"].named_steps["model"].decision_function(artifact["model"].named_steps["imputer"].transform(X))
    anomalies = []
    for row, label, score in zip(rows, labels, scores):
        if label == -1:
            anomalies.append({"segmentStart": row["segment_start"].isoformat(), "segmentEnd": row["segment_end"].isoformat(), "score": float(score), "typeGuess": _anomaly_type(row), "explanation": _anomaly_explanation(row)})
    return anomalies


def rank_flight_windows(windows: list[dict[str, Any]], user_profile: dict[str, Any], repo: Repository) -> list[dict[str, Any]]:
    ranked = []
    for window in windows:
        features = {
            **user_profile,
            "temperature_celsius": window.get("temperatureCelsius"),
            "wind_speed_kph": window.get("windSpeedKph"),
            "wind_speed_altitude_kph": window.get("windSpeed80mKph") or window.get("windSpeed100mKph") or window.get("windSpeed120mKph"),
            "wind_gust_kph": window.get("windGustKph"),
            "precipitation_mm": window.get("precipitationMm"),
            "precipitation_probability": window.get("precipitationProbability"),
            "visibility_meters": window.get("visibilityMeters"),
            "cloud_cover_percent": window.get("cloudCoverPercent"),
        }
        battery = predict_battery(features, repo) if ARTIFACTS.get("battery") else {"confidence": "Not available"}
        risk = predict_risk(features, repo) if ARTIFACTS.get("risk") else {"riskClass": "Caution", "confidence": "Low"}
        score = _flyability_score(window, risk)
        ranked.append({**window, "predictedBatteryEfficiency": battery, "risk": risk, "flyabilityScore": score, "recommendation": _recommendation(score), "explanation": "Ranked from forecast weather plus uploaded flight profile and trained models when available."})
    return sorted(ranked, key=lambda row: row["flyabilityScore"], reverse=True)


def confidence_report(training_flights: int, training_rows: int, completeness: float, metrics: dict[str, Any], weak_labels: bool = False) -> dict[str, Any]:
    reasons = []
    label = "Low"
    if training_flights >= 5 and training_rows >= 200 and completeness >= 75 and not weak_labels:
        label = "High"
        reasons.append("Multiple flights, enough segment rows, high feature completeness, and non-weak labels.")
    elif training_rows >= 40 and completeness >= 55:
        label = "Medium"
        reasons.append("Enough segment rows for useful validation, but more flights or features would improve confidence.")
    else:
        reasons.append("Upload more flights with battery, speed, altitude, GPS/signal, and weather for stronger confidence.")
    if weak_labels:
        label = "Low" if label == "Medium" else label
        reasons.append("Risk classifier is weakly supervised until true human labels exist.")
    return {"label": label, "trainingFlights": training_flights, "trainingRows": training_rows, "featureCompleteness": completeness, "reasons": reasons, "metricsChecked": list(metrics.keys())}


def _battery_training_rows(flight_rows, segment_rows):
    rows = []
    for row in flight_rows:
        if row.get("label_battery_used_percent") is not None:
            rows.append({**row, "target": row["label_battery_used_percent"]})
    for row in segment_rows:
        if row.get("battery_delta") is not None:
            rows.append({
                "flight_id": row["flight_id"],
                "duration_seconds": row["segment_duration"],
                "total_distance_meters": row["segment_distance"],
                "altitude_gain_meters": max(0, row.get("altitude_delta") or 0),
                "average_speed_mps": row.get("average_speed"),
                "max_speed_mps": row.get("max_speed"),
                "speed_variation": row.get("speed_variance"),
                "hover_ratio": row.get("hover_ratio"),
                "distance_from_home_meters": row.get("distance_from_home"),
                "gps_satellites": row.get("gps_satellites"),
                "signal_strength_percent": row.get("signal_strength"),
                "temperature_celsius": row.get("temperature"),
                "wind_speed_kph": row.get("wind_speed"),
                "wind_speed_altitude_kph": row.get("wind_speed_altitude"),
                "wind_gust_kph": row.get("wind_gust"),
                "precipitation_mm": row.get("precipitation_mm"),
                "precipitation_probability": row.get("precipitation_probability"),
                "feature_completeness_score": row.get("feature_completeness_score"),
                "target": row["battery_delta"],
            })
    return rows


def _validation_split(X, y, groups):
    unique_groups = list(set(groups))
    if len(unique_groups) >= 3:
        splitter = GroupKFold(n_splits=min(5, len(unique_groups)))
        train_idx, test_idx = next(splitter.split(X, y, groups))
        return {"train_idx": train_idx, "test_idx": test_idx, "strategy": "GroupKFold by flight_id"}
    if len(unique_groups) == 2:
        splitter = LeaveOneGroupOut()
        train_idx, test_idx = next(splitter.split(X, y, groups))
        return {"train_idx": train_idx, "test_idx": test_idx, "strategy": "leave-one-flight-out"}
    split = int(len(X) * 0.75)
    return {"train_idx": np.arange(0, max(1, split)), "test_idx": np.arange(max(1, split), len(X)), "strategy": "time-block validation; low confidence with one flight"}


def _fit_regressor(name, model, X, y, split):
    train_idx, test_idx = split["train_idx"], split["test_idx"]
    if len(test_idx) == 0:
        train_idx, test_idx = np.arange(0, len(X) - 1), np.array([len(X) - 1])
    model.fit(X.iloc[train_idx], y.iloc[train_idx])
    pred = model.predict(X.iloc[test_idx])
    metrics = {
        "mae": float(mean_absolute_error(y.iloc[test_idx], pred)),
        "rmse": float(mean_squared_error(y.iloc[test_idx], pred) ** 0.5),
        "r2": float(r2_score(y.iloc[test_idx], pred)) if len(test_idx) > 1 else None,
        "median_absolute_error": float(median_absolute_error(y.iloc[test_idx], pred)),
        "prediction_interval_width": float(np.percentile(pred, 90) - np.percentile(pred, 10)) if len(pred) > 1 else None,
        "candidate": name,
    }
    return model, metrics


def _save_artifact(repo, key, model, features, train_ranges):
    payload = io.BytesIO()
    joblib.dump(
        {
            "model": model,
            "features": features,
            "train_ranges": train_ranges,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        payload,
    )
    return repo.save_model_artifact(key, payload.getvalue())


def _artifact_key(run):
    return {
        "battery_used_percent": "battery",
        "weak_risk_label": "risk",
        "segment_outlier_score": "anomaly",
    }.get(run.get("target_name"))


def _available_feature_columns(df, candidates):
    return [column for column in candidates if column in df.columns and df[column].notna().any()]


def _model_run(name, model_type, target, rows, flights, strategy, metrics, importance, confidence, artifact_path, notes=""):
    return {
        "id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model_name": name,
        "model_type": model_type,
        "target_name": target,
        "training_rows": rows,
        "training_flights": flights,
        "validation_strategy": strategy,
        "metrics_json": metrics,
        "feature_importance_json": importance,
        "confidence_json": confidence,
        "artifact_path": artifact_path,
        "status": "trained",
        "notes": notes,
    }


def _not_available(model_name, reason):
    return {"model_name": model_name, "status": "not_available", "reason": reason, "confidence_json": {"label": "Not available", "reasons": [reason]}}


def _feature_importance(model, columns):
    estimator = model.named_steps.get("model") if hasattr(model, "named_steps") else model
    values = getattr(estimator, "feature_importances_", None)
    if values is None and hasattr(estimator, "coef_"):
        values = np.abs(estimator.coef_).ravel()
    if values is None:
        return []
    return [{"feature": col, "importance": float(val)} for col, val in sorted(zip(columns, values), key=lambda item: item[1], reverse=True)]


def _ranges(X):
    return {col: {"min": float(pd.to_numeric(X[col], errors="coerce").min()), "max": float(pd.to_numeric(X[col], errors="coerce").max())} for col in X.columns}


def _prediction_interval(model, X, prediction):
    estimator = model.named_steps.get("model") if hasattr(model, "named_steps") else model
    if hasattr(estimator, "estimators_"):
        transformed = X
        if hasattr(model, "named_steps") and "imputer" in model.named_steps:
            transformed = model.named_steps["imputer"].transform(X)
        preds = np.array([tree.predict(transformed)[0] for tree in estimator.estimators_])
        return float(np.percentile(preds, 10)), float(np.percentile(preds, 90))
    return max(0.0, prediction * 0.85), prediction * 1.15


def _prediction_confidence(features, artifact):
    reasons = []
    out = []
    ranges = artifact.get("train_ranges", {})
    for key, value in features.items():
        if key in ranges and value is not None:
            if value < ranges[key]["min"] or value > ranges[key]["max"]:
                out.append(key)
    label = artifact["run"].get("confidence_json", {}).get("label", "Low")
    if out:
        label = "Low"
        reasons.append("This forecast is outside your training conditions: " + ", ".join(out))
    reasons.extend(artifact["run"].get("confidence_json", {}).get("reasons", []))
    return {"label": label, "reasons": reasons, "outOfDistribution": out}


def _anomaly_type(row):
    if row.get("battery_delta", 0) > 4:
        return "high battery drain"
    if abs(row.get("altitude_delta") or 0) > 12:
        return "sudden altitude change"
    if row.get("speed_variance", 0) and row["speed_variance"] > 8:
        return "unstable speed"
    if row.get("signal_strength", 100) < 45 or row.get("gps_satellites", 99) < 7:
        return "poor signal/GPS"
    return "unusual telemetry segment"


def _anomaly_explanation(row):
    return f"IsolationForest marked this segment as unusual; likely cause: {_anomaly_type(row)}."


def _flyability_score(window, risk):
    score = 88
    altitude_wind = window.get("windSpeed80mKph") or window.get("windSpeed100mKph") or window.get("windSpeed120mKph") or window.get("windSpeedKph") or 0
    score -= max(0, altitude_wind - 10) * 1.8
    score -= max(0, (window.get("windGustKph") or 0) - 16) * 1.4
    score -= (window.get("precipitationProbability") or 0) * 0.4
    if risk.get("riskClass") == "High":
        score -= 20
    elif risk.get("riskClass") == "Medium":
        score -= 10
    return max(0, min(100, round(score)))


def _recommendation(score):
    if score >= 82:
        return "Best"
    if score >= 66:
        return "Good"
    if score >= 45:
        return "Caution"
    return "Avoid"
