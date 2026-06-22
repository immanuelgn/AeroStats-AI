from __future__ import annotations

from statistics import mean, pstdev
from typing import Any
from .analytics import haversine, feature_completeness
from .models import FlightRecord, TelemetryPoint


FEATURE_COLUMNS = [
    "duration_seconds",
    "total_distance_meters",
    "altitude_gain_meters",
    "average_speed_mps",
    "max_speed_mps",
    "speed_variation",
    "hover_ratio",
    "battery_drain_history",
    "distance_from_home_meters",
    "route_efficiency",
    "aggressive_movement_score",
    "gps_satellites",
    "signal_strength_percent",
    "temperature_celsius",
    "wind_speed_kph",
    "wind_speed_altitude_kph",
    "wind_gust_kph",
    "precipitation_mm",
    "precipitation_probability",
    "visibility_meters",
    "cloud_cover_percent",
]


def extract_flight_feature_vector(flight: FlightRecord) -> dict[str, Any]:
    speeds = [p.speedMps for p in flight.telemetry if p.speedMps is not None]
    satellites = [p.gpsSatellites for p in flight.telemetry if p.gpsSatellites is not None]
    signals = [p.signalStrengthPercent for p in flight.telemetry if p.signalStrengthPercent is not None]
    weather = [p.weather for p in flight.telemetry if p.weather]
    return {
        "flight_id": flight.id,
        "duration_seconds": flight.metrics.durationSeconds,
        "total_distance_meters": flight.metrics.totalDistanceMeters,
        "altitude_gain_meters": flight.metrics.altitudeGainMeters,
        "average_speed_mps": flight.metrics.averageSpeedMps,
        "max_speed_mps": flight.metrics.maxSpeedMps,
        "speed_variation": pstdev(speeds) if len(speeds) > 1 else None,
        "hover_ratio": flight.metrics.hoverRatio,
        "battery_drain_history": flight.metrics.batteryDrainPerMinute,
        "distance_from_home_meters": max([p.distanceFromHomeMeters for p in flight.telemetry if p.distanceFromHomeMeters is not None], default=None),
        "route_efficiency": flight.metrics.routeEfficiency,
        "aggressive_movement_score": flight.metrics.aggressiveMovementScore,
        "gps_satellites": mean(satellites) if satellites else None,
        "signal_strength_percent": mean(signals) if signals else None,
        "temperature_celsius": _weather_mean(weather, "temperatureCelsius"),
        "wind_speed_kph": _weather_mean(weather, "windSpeedKph"),
        "wind_speed_altitude_kph": _weather_altitude_wind(weather),
        "wind_gust_kph": _weather_mean(weather, "windGustKph"),
        "precipitation_mm": _weather_mean(weather, "precipitationMm"),
        "precipitation_probability": _weather_mean(weather, "precipitationProbability"),
        "visibility_meters": _weather_mean(weather, "visibilityMeters"),
        "cloud_cover_percent": _weather_mean(weather, "cloudCoverPercent"),
        "feature_completeness_score": flight.metrics.featureCompletenessScore,
        "label_battery_used_percent": flight.metrics.batteryUsedPercent,
        "weak_risk_label": weak_risk_label(flight),
    }


def build_segment_vectors(flight: FlightRecord, window_seconds: int = 15) -> list[dict[str, Any]]:
    points = flight.telemetry
    if len(points) < 2:
        return []
    segments: list[dict[str, Any]] = []
    start_index = 0
    for index in range(1, len(points)):
        if (points[index].timestamp - points[start_index].timestamp).total_seconds() >= window_seconds:
            segment = points[start_index : index + 1]
            vector = _segment_vector(flight.id, segment)
            if vector:
                segments.append(vector)
            start_index = index
    return segments


def weak_risk_label(flight: FlightRecord) -> str:
    score = 0
    if flight.metrics.returnMarginScore is not None and flight.metrics.returnMarginScore < 20:
        score += 2
    if flight.metrics.signalStabilityScore is not None and flight.metrics.signalStabilityScore < 55:
        score += 2
    if flight.metrics.batteryDrainPerMinute is not None and flight.metrics.batteryDrainPerMinute > 2.4:
        score += 2
    if flight.metrics.aggressiveMovementScore is not None and flight.metrics.aggressiveMovementScore > 55:
        score += 1
    if flight.metrics.windImpactScore is not None and flight.metrics.windImpactScore > 45:
        score += 1
    return "High" if score >= 4 else "Medium" if score >= 2 else "Low"


def _segment_vector(flight_id: str | None, segment: list[TelemetryPoint]) -> dict[str, Any] | None:
    duration = (segment[-1].timestamp - segment[0].timestamp).total_seconds()
    if duration <= 0:
        return None
    distance = sum(haversine(segment[i - 1], segment[i]) for i in range(1, len(segment)))
    speeds = [p.speedMps for p in segment if p.speedMps is not None]
    headings = [p.headingDegrees for p in segment if p.headingDegrees is not None]
    altitudes = [p.altitudeMeters for p in segment if p.altitudeMeters is not None]
    batteries = [p.batteryPercent for p in segment if p.batteryPercent is not None]
    signals = [p.signalStrengthPercent for p in segment if p.signalStrengthPercent is not None]
    satellites = [p.gpsSatellites for p in segment if p.gpsSatellites is not None]
    weather = [p.weather for p in segment if p.weather]
    return {
        "flight_id": flight_id,
        "segment_start": segment[0].timestamp,
        "segment_end": segment[-1].timestamp,
        "feature_type": "segment",
        "feature_completeness_score": feature_completeness(segment),
        "segment_duration": duration,
        "segment_distance": distance,
        "altitude_delta": (altitudes[-1] - altitudes[0]) if len(altitudes) >= 2 else None,
        "average_speed": mean(speeds) if speeds else distance / duration,
        "max_speed": max(speeds) if speeds else None,
        "speed_variance": pstdev(speeds) if len(speeds) > 1 else None,
        "acceleration_proxy": (max(speeds) - min(speeds)) / duration if len(speeds) > 1 else None,
        "hover_ratio": len([s for s in speeds if s < 0.8]) / len(speeds) if speeds else None,
        "heading_change": abs(headings[-1] - headings[0]) if len(headings) >= 2 else None,
        "battery_start": batteries[0] if batteries else None,
        "battery_delta": max(0, batteries[0] - batteries[-1]) if len(batteries) >= 2 else None,
        "distance_from_home": max([p.distanceFromHomeMeters for p in segment if p.distanceFromHomeMeters is not None], default=None),
        "gps_satellites": mean(satellites) if satellites else None,
        "signal_strength": mean(signals) if signals else None,
        "wind_speed": _weather_mean(weather, "windSpeedKph"),
        "wind_speed_altitude": _weather_altitude_wind(weather),
        "wind_gust": _weather_mean(weather, "windGustKph"),
        "temperature": _weather_mean(weather, "temperatureCelsius"),
        "precipitation_mm": _weather_mean(weather, "precipitationMm"),
        "precipitation_probability": _weather_mean(weather, "precipitationProbability"),
    }


def _weather_mean(weather: list[dict[str, Any]], key: str) -> float | None:
    values = [item.get(key) for item in weather if item and item.get(key) is not None]
    return mean(values) if values else None


def _weather_altitude_wind(weather: list[dict[str, Any]]) -> float | None:
    for key in ("windSpeed100mKph", "windSpeed80mKph", "windSpeed120mKph"):
        value = _weather_mean(weather, key)
        if value is not None:
            return value
    return _weather_mean(weather, "windSpeedKph")
