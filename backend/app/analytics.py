from math import asin, cos, radians, sin, sqrt
from statistics import mean
from .models import FlightMetrics, TelemetryPoint


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def haversine(a: TelemetryPoint, b: TelemetryPoint) -> float:
    radius = 6371000
    d_lat = radians(b.latitude - a.latitude)
    d_lon = radians(b.longitude - a.longitude)
    lat1 = radians(a.latitude)
    lat2 = radians(b.latitude)
    h = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lon / 2) ** 2
    return 2 * radius * asin(sqrt(h))


def total_distance(points: list[TelemetryPoint]) -> float | None:
    if len(points) < 2:
        return None
    return sum(haversine(points[index - 1], points[index]) for index in range(1, len(points)))


def duration_seconds(points: list[TelemetryPoint]) -> int | None:
    if len(points) < 2:
        return None
    seconds = int((points[-1].timestamp - points[0].timestamp).total_seconds())
    return seconds if seconds > 0 else None


def feature_completeness(points: list[TelemetryPoint]) -> float:
    if not points:
        return 0
    checks = [
        all(p.timestamp and p.latitude is not None and p.longitude is not None for p in points),
        any(p.batteryPercent is not None for p in points),
        any(p.altitudeMeters is not None for p in points),
        any(p.speedMps is not None for p in points),
        any(p.distanceFromHomeMeters is not None for p in points),
        any(p.gpsSatellites is not None or p.signalStrengthPercent is not None for p in points),
        any(p.weather for p in points),
    ]
    weights = [25, 18, 12, 12, 10, 12, 11]
    return round(sum(weight for ok, weight in zip(checks, weights) if ok), 2)


def derive_flight_metrics(points: list[TelemetryPoint]) -> FlightMetrics:
    distance = total_distance(points)
    duration = duration_seconds(points)
    batteries = [p.batteryPercent for p in points if p.batteryPercent is not None]
    speeds = [p.speedMps for p in points if p.speedMps is not None]
    altitudes = [p.altitudeMeters for p in points if p.altitudeMeters is not None]
    signals = [p.signalStrengthPercent for p in points if p.signalStrengthPercent is not None]
    satellites = [p.gpsSatellites for p in points if p.gpsSatellites is not None]
    weather_winds = [p.weather.get("windSpeedKph") for p in points if p.weather and p.weather.get("windSpeedKph") is not None]
    battery_used = max(0, batteries[0] - batteries[-1]) if len(batteries) >= 2 else None
    hover_ratio = len([s for s in speeds if s < 0.8]) / len(speeds) if speeds else None
    altitude_gain = None
    if altitudes:
        gain = 0.0
        for index in range(1, len(points)):
            prev = points[index - 1].altitudeMeters
            cur = points[index].altitudeMeters
            if prev is not None and cur is not None and cur > prev:
                gain += cur - prev
        altitude_gain = gain
    route_efficiency = None
    if distance and len(points) >= 2:
        route_efficiency = clamp((haversine(points[0], points[-1]) / distance) * 100)
    aggressive = None
    if len(speeds) > 2:
        changes = [abs(speeds[i] - speeds[i - 1]) for i in range(1, len(speeds))]
        aggressive = clamp(mean(changes) * 18)
    signal_stability = None
    if signals:
        signal_stability = clamp(mean(signals))
    elif satellites:
        signal_stability = clamp(mean(satellites) / 18 * 100)
    return_margin = None
    if points and points[-1].distanceFromHomeMeters is not None and points[-1].batteryPercent is not None:
        return_margin = clamp(points[-1].batteryPercent - points[-1].distanceFromHomeMeters / 120)
    return FlightMetrics(
        durationSeconds=duration,
        totalDistanceMeters=distance,
        batteryUsedPercent=battery_used,
        maxAltitudeMeters=max(altitudes) if altitudes else None,
        averageSpeedMps=mean(speeds) if speeds else (distance / duration if distance and duration else None),
        maxSpeedMps=max(speeds) if speeds else None,
        hoverRatio=hover_ratio,
        altitudeGainMeters=altitude_gain,
        batteryDrainPerMinute=battery_used / (duration / 60) if battery_used is not None and duration else None,
        batteryDrainPer100m=(battery_used / distance) * 100 if battery_used is not None and distance else None,
        routeEfficiency=route_efficiency,
        aggressiveMovementScore=aggressive,
        signalStabilityScore=signal_stability,
        returnMarginScore=return_margin,
        windImpactScore=clamp(mean(weather_winds) * 3) if weather_winds else None,
        featureCompletenessScore=feature_completeness(points),
    )
