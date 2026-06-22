from __future__ import annotations

import httpx
from datetime import datetime, timedelta, timezone
from typing import Any
from .config import Settings
from .models import FlightRecord
from .repository import Repository

HISTORICAL_HOURLY = (
    "temperature_2m,relative_humidity_2m,surface_pressure,precipitation,"
    "weather_code,cloud_cover,wind_speed_10m,wind_speed_100m,"
    "wind_direction_10m,wind_direction_100m,wind_gusts_10m"
)
FORECAST_HOURLY = (
    "temperature_2m,relative_humidity_2m,surface_pressure,precipitation,"
    "precipitation_probability,weather_code,cloud_cover,visibility,"
    "wind_speed_10m,wind_speed_80m,wind_speed_120m,"
    "wind_direction_10m,wind_direction_80m,wind_direction_120m,wind_gusts_10m"
)


async def get_historical_weather_for_flight(flight: FlightRecord, repo: Repository, settings: Settings) -> list[dict[str, Any]]:
    if not flight.telemetry:
        return []
    first = flight.telemetry[0]
    start = first.timestamp.date().isoformat()
    cache_key = f"historical:v2:{first.latitude:.3f}:{first.longitude:.3f}:{start}"
    cached = repo.get_weather_cache(cache_key)
    if cached:
        return cached["response_json"]
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {"latitude": first.latitude, "longitude": first.longitude, "start_date": start, "end_date": start, "hourly": HISTORICAL_HOURLY}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
    snapshots = _normalize_hourly(response.json(), first.latitude, first.longitude)
    cache_weather_result(repo, cache_key, first.latitude, first.longitude, snapshots, "open-meteo")
    return snapshots


async def get_forecast_windows(lat: float, lon: float, repo: Repository, settings: Settings) -> list[dict[str, Any]]:
    cache_key = f"forecast:v2:{lat:.3f}:{lon:.3f}:{datetime.now(timezone.utc).strftime('%Y-%m-%d-%H')}"
    cached = repo.get_weather_cache(cache_key)
    if cached:
        return cached["response_json"]
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{settings.open_meteo_base_url}/forecast", params={"latitude": lat, "longitude": lon, "forecast_days": 2, "hourly": FORECAST_HOURLY})
        response.raise_for_status()
    windows = _normalize_hourly(response.json(), lat, lon)[:24]
    cache_weather_result(repo, cache_key, lat, lon, windows, "open-meteo")
    return windows


def join_weather_to_telemetry(flight: FlightRecord, snapshots: list[dict[str, Any]]) -> FlightRecord:
    if not snapshots:
        return flight
    for point in flight.telemetry:
        closest = min(snapshots, key=lambda snap: abs(datetime.fromisoformat(snap["timestamp"]) - point.timestamp))
        point.weather = closest
    return flight


def summarize_weather_impact(flight: FlightRecord) -> str:
    winds = [p.weather.get("windSpeedKph") for p in flight.telemetry if p.weather and p.weather.get("windSpeedKph") is not None]
    if not winds:
        return "Weather can be joined after GPS and timestamp telemetry is available."
    avg = sum(winds) / len(winds)
    return "Joined weather suggests wind may have reduced battery efficiency." if avg > 18 else "Joined weather suggests modest wind impact."


def cache_weather_result(repo: Repository, cache_key: str, lat: float, lon: float, payload: list[dict[str, Any]], provider: str) -> None:
    repo.save_weather_cache({"cache_key": cache_key, "latitude": lat, "longitude": lon, "provider": provider, "response_json": payload})


def get_weather_provider_status(settings: Settings) -> dict[str, Any]:
    return {"provider": "Open-Meteo", "available": True, "baseUrl": settings.open_meteo_base_url, "attribution": "Weather data provided by Open-Meteo."}


def _normalize_hourly(data: dict[str, Any], lat: float, lon: float) -> list[dict[str, Any]]:
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    rows = []
    for index, value in enumerate(times):
        rows.append({
            "timestamp": datetime.fromisoformat(value).replace(tzinfo=timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "temperatureCelsius": _at(hourly, "temperature_2m", index),
            "relativeHumidityPercent": _at(hourly, "relative_humidity_2m", index),
            "surfacePressureHpa": _at(hourly, "surface_pressure", index),
            "windSpeedKph": _at(hourly, "wind_speed_10m", index),
            "windSpeed80mKph": _at(hourly, "wind_speed_80m", index),
            "windSpeed100mKph": _at(hourly, "wind_speed_100m", index),
            "windSpeed120mKph": _at(hourly, "wind_speed_120m", index),
            "windGustKph": _at(hourly, "wind_gusts_10m", index),
            "windDirectionDegrees": _at(hourly, "wind_direction_10m", index),
            "windDirection80mDegrees": _at(hourly, "wind_direction_80m", index),
            "windDirection100mDegrees": _at(hourly, "wind_direction_100m", index),
            "windDirection120mDegrees": _at(hourly, "wind_direction_120m", index),
            "precipitationMm": _at(hourly, "precipitation", index),
            "precipitationProbability": _at(hourly, "precipitation_probability", index),
            "cloudCoverPercent": _at(hourly, "cloud_cover", index),
            "visibilityMeters": _at(hourly, "visibility", index),
            "weatherCode": _at(hourly, "weather_code", index),
            "provider": "open-meteo",
        })
    return rows


def _at(hourly: dict[str, Any], key: str, index: int):
    values = hourly.get(key) or []
    return values[index] if index < len(values) else None
