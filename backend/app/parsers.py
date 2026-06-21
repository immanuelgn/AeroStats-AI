from __future__ import annotations

import csv
import io
import json
import zipfile
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
import pandas as pd
from .analytics import derive_flight_metrics
from .models import FlightRecord, ParserDiagnostic, ParserResult, TelemetryPoint

FIELD_ALIASES = {
    "timestamp": ["timestamp", "time", "datetime", "dateTime", "date"],
    "latitude": ["latitude", "lat", "gpsLatitude"],
    "longitude": ["longitude", "lon", "lng", "gpsLongitude"],
    "altitudeMeters": ["altitudeMeters", "altitude", "height", "heightMeters", "altitude_m"],
    "speedMps": ["speedMps", "speed", "speed_mps", "horizontalSpeed"],
    "batteryPercent": ["batteryPercent", "battery", "battery_percent", "batteryLevel"],
    "distanceFromHomeMeters": ["distanceFromHomeMeters", "distanceFromHome", "homeDistance"],
    "headingDegrees": ["headingDegrees", "heading", "yaw"],
    "verticalSpeedMps": ["verticalSpeedMps", "verticalSpeed", "vz"],
    "gpsSatellites": ["gpsSatellites", "satellites", "satelliteCount"],
    "signalStrengthPercent": ["signalStrengthPercent", "signalStrength", "signal"],
    "eventType": ["eventType", "event", "message"],
}


def detect_file_type(filename: str) -> str:
    lowered = filename.lower()
    if lowered.endswith(".csv"):
        return "csv"
    if lowered.endswith(".json"):
        return "json"
    if lowered.endswith(".txt"):
        return "txt"
    if lowered.endswith(".zip"):
        return "zip"
    return "unknown"


def parse_uploaded_flight_file(filename: str, content: bytes) -> ParserResult:
    file_type = detect_file_type(filename)
    if file_type == "csv":
        return parse_flight_csv(filename, content.decode("utf-8-sig", errors="replace"))
    if file_type == "json":
        return parse_flight_json(filename, content.decode("utf-8-sig", errors="replace"))
    if file_type == "txt":
        return parse_dji_flight_record(filename)
    if file_type == "zip":
        return parse_dji_flightrecords_zip(filename, content)
    return _empty(filename, "unsupported file", ["Upload .csv, .json, .txt, or .zip only."])


def parse_flight_csv(filename: str, text: str) -> ParserResult:
    rows = list(csv.DictReader(io.StringIO(text)))
    return _result_from_rows(filename, rows, "parse_flight_csv")


def parse_flight_json(filename: str, text: str) -> ParserResult:
    parsed = json.loads(text)
    if isinstance(parsed, list):
        return _result_from_rows(filename, parsed, "parse_flight_json")
    if isinstance(parsed, dict) and isinstance(parsed.get("flights"), list):
        flights: list[FlightRecord] = []
        diagnostics: list[ParserDiagnostic] = []
        for index, flight in enumerate(parsed["flights"]):
            rows = flight.get("telemetry") or flight.get("points") or []
            partial = _result_from_rows(filename, rows, "parse_flight_json")
            for parsed_flight in partial.flights:
                parsed_flight.name = flight.get("name") or f"{filename} flight {index + 1}"
            flights.extend(partial.flights)
            diagnostics.extend(partial.diagnostics)
        return _result_from_flights(filename, flights, diagnostics)
    rows = parsed.get("telemetry") or parsed.get("points") if isinstance(parsed, dict) else None
    if isinstance(rows, list):
        return _result_from_rows(filename, rows, "parse_flight_json")
    return _empty(filename, "invalid telemetry structure", ["JSON must be an array, telemetry object, points object, or flights array."])


def parse_dji_flight_record(filename: str) -> ParserResult:
    return _empty(filename, "partially parsed", ["DJI TXT parser is scaffolded. Add DJI field extraction before treating this format as normalized telemetry."])


def parse_dji_flightrecords_zip(filename: str, content: bytes) -> ParserResult:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = archive.namelist()
    except zipfile.BadZipFile:
        return _empty(filename, "parse failed", ["Zip file could not be opened."])
    dji_like = [name for name in names if "flightrecord" in name.lower() or name.lower().endswith(".txt")]
    return _empty(
        filename,
        "partially parsed",
        [f"Detected {len(dji_like)} DJI-like files, but DJI FlightRecords parsing is not implemented yet. No fake parsing success was returned."],
    )


def normalize_telemetry(row: dict[str, Any]) -> TelemetryPoint | None:
    normalized: dict[str, Any] = {}
    for canonical, aliases in FIELD_ALIASES.items():
        source = next((alias for alias in aliases if row.get(alias) not in (None, "")), None)
        if not source:
            continue
        value = row[source]
        if canonical == "timestamp":
            normalized[canonical] = _parse_timestamp(value)
        elif canonical == "eventType":
            normalized[canonical] = str(value)
        elif canonical == "gpsSatellites":
            normalized[canonical] = int(float(value))
        else:
            normalized[canonical] = float(value)
    try:
        return TelemetryPoint(**normalized)
    except Exception:
        return None


def validate_flight_record(points: list[TelemetryPoint]) -> tuple[list[str], list[str]]:
    missing_required = []
    if not points:
        missing_required.extend(["timestamp", "latitude", "longitude"])
    recommended = ["altitudeMeters", "speedMps", "batteryPercent", "distanceFromHomeMeters", "headingDegrees", "gpsSatellites", "signalStrengthPercent"]
    missing_recommended = [field for field in recommended if not any(getattr(point, field) is not None for point in points)]
    return missing_required, missing_recommended


def extract_flight_metadata(points: list[TelemetryPoint]) -> dict[str, Any]:
    return {
        "startedAt": points[0].timestamp if points else None,
        "endedAt": points[-1].timestamp if points else None,
        "locationName": f"{points[0].latitude:.4f}, {points[0].longitude:.4f}" if points else None,
    }


def split_into_flights(points: list[TelemetryPoint]) -> list[list[TelemetryPoint]]:
    ordered = sorted(points, key=lambda point: point.timestamp)
    flights: list[list[TelemetryPoint]] = []
    current: list[TelemetryPoint] = []
    for point in ordered:
        if current and (point.timestamp - current[-1].timestamp).total_seconds() > 1800:
            flights.append(current)
            current = []
        current.append(point)
    if current:
        flights.append(current)
    return flights


def downsample_telemetry_for_replay(points: list[TelemetryPoint], max_points: int = 900) -> list[TelemetryPoint]:
    if len(points) <= max_points:
        return points
    step = max(1, len(points) // max_points)
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled


def generate_flight_events(points: list[TelemetryPoint]) -> list[dict[str, Any]]:
    if not points:
        return []
    events = [{"type": "takeoff", "label": "Takeoff", "timestamp": points[0].timestamp.isoformat(), "telemetryIndex": 0, "severity": "info"}]
    peak_altitude = max(enumerate(points), key=lambda item: item[1].altitudeMeters if item[1].altitudeMeters is not None else -999)
    if peak_altitude[1].altitudeMeters is not None:
        events.append({"type": "peak-altitude", "label": "Peak altitude", "timestamp": peak_altitude[1].timestamp.isoformat(), "telemetryIndex": peak_altitude[0], "severity": "info"})
    low_signal = next(((i, p) for i, p in enumerate(points) if (p.signalStrengthPercent is not None and p.signalStrengthPercent < 45) or (p.gpsSatellites is not None and p.gpsSatellites < 7)), None)
    if low_signal:
        events.append({"type": "low-signal", "label": "Low signal segment", "timestamp": low_signal[1].timestamp.isoformat(), "telemetryIndex": low_signal[0], "severity": "caution"})
    events.append({"type": "landing", "label": "Landing", "timestamp": points[-1].timestamp.isoformat(), "telemetryIndex": len(points) - 1, "severity": "info"})
    return events


def generate_flight_tags(metrics) -> list[str]:
    tags = []
    if metrics.hoverRatio and metrics.hoverRatio > 0.35:
        tags.append("Hover-heavy")
    if metrics.batteryDrainPerMinute and metrics.batteryDrainPerMinute > 2.5:
        tags.append("High battery drain")
    if metrics.signalStabilityScore is not None and metrics.signalStabilityScore < 60:
        tags.append("Low signal segment")
    if metrics.routeEfficiency and metrics.routeEfficiency > 65:
        tags.append("Efficient cruise")
    return tags or ["Telemetry baseline"]


def _result_from_rows(filename: str, rows: list[dict[str, Any]], parser_name: str) -> ParserResult:
    points = [point for row in rows if (point := normalize_telemetry(row))]
    flights = []
    diagnostics = []
    for index, group in enumerate(split_into_flights(points)):
        missing_required, missing_recommended = validate_flight_record(group)
        confidence = max(10, 100 - len(missing_required) * 25 - len(missing_recommended) * 7)
        metrics = derive_flight_metrics(group)
        metadata = extract_flight_metadata(group)
        flight = FlightRecord(
            id=str(uuid4()),
            name=f"{filename.rsplit('.', 1)[0]} flight {index + 1}",
            sourceFilename=filename,
            sourceType=detect_file_type(filename),
            parserConfidence=confidence,
            telemetry=group,
            downsampledTelemetry=downsample_telemetry_for_replay(group),
            metrics=metrics,
            events=generate_flight_events(group),
            tags=generate_flight_tags(metrics),
            featureAvailability=_feature_availability(group),
            **metadata,
        )
        flights.append(flight)
        diagnostics.append(ParserDiagnostic(sourceFilename=filename, parserName=parser_name, status="success" if confidence >= 75 else "partially parsed", confidence=confidence, missingFields=missing_required + missing_recommended, warnings=[]))
    return _result_from_flights(filename, flights, diagnostics)


def _result_from_flights(filename: str, flights: list[FlightRecord], diagnostics: list[ParserDiagnostic]) -> ParserResult:
    points = sum(len(f.telemetry) for f in flights)
    confidence = sum(d.confidence for d in diagnostics) / len(diagnostics) if diagnostics else 0
    missing = sorted({field for diagnostic in diagnostics for field in diagnostic.missingFields})
    status = "success" if flights and confidence >= 75 else "partially parsed" if flights else "invalid telemetry structure"
    return ParserResult(
        status=status,
        detectedFlights=len(flights),
        telemetryPoints=points,
        parserConfidence=round(confidence, 2),
        missingFields=missing,
        warnings=[warning for diagnostic in diagnostics for warning in diagnostic.warnings],
        nextRecommendedAction="Persist parsed flights, extract features, and open replay." if flights else "Upload internal CSV/JSON telemetry with timestamp, latitude, longitude.",
        flights=flights,
        diagnostics=diagnostics,
    )


def _empty(filename: str, status: str, warnings: list[str]) -> ParserResult:
    diagnostic = ParserDiagnostic(sourceFilename=filename, parserName="detect_file_type", status=status, confidence=0, missingFields=["timestamp", "latitude", "longitude"], warnings=warnings)
    return ParserResult(status=status, detectedFlights=0, telemetryPoints=0, parserConfidence=0, missingFields=diagnostic.missingFields, warnings=warnings, nextRecommendedAction="Check the file format or add parser support.", flights=[], diagnostics=[diagnostic])


def _parse_timestamp(value: Any) -> datetime:
    parsed = pd.to_datetime(value, utc=True, errors="raise")
    return parsed.to_pydatetime()


def _feature_availability(points: list[TelemetryPoint]) -> dict[str, bool]:
    return {
        "mapPath": bool(points),
        "replay": bool(points),
        "batteryAnalytics": any(p.batteryPercent is not None for p in points),
        "altitudeChart": any(p.altitudeMeters is not None for p in points),
        "speedChart": any(p.speedMps is not None for p in points),
        "signalStability": any(p.gpsSatellites is not None or p.signalStrengthPercent is not None for p in points),
        "weatherJoin": bool(points),
    }
