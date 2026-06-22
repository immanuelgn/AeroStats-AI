import type { FlightRecord, TelemetryPoint, WeatherMode, WeatherProvider, WeatherProviderStatus, WeatherSnapshot, WeatherWindow } from "@/types";

const cache = new Map<string, WeatherSnapshot[] | WeatherWindow[]>();

export function getWeatherProvider(mode: WeatherMode): WeatherProvider {
  if (mode === "mock") return new MockWeatherProvider();
  if (mode === "open-meteo") return new OpenMeteoWeatherProvider();
  return new DisabledWeatherProvider();
}

export class DisabledWeatherProvider implements WeatherProvider {
  mode: WeatherMode = "disabled";
  async getHistoricalWeatherForFlight() {
    return [];
  }
  async getForecastWindows() {
    return [];
  }
  getStatus(): WeatherProviderStatus {
    return {
      mode: "disabled",
      available: false,
      label: "Disabled",
      message: "Weather mode is disabled until valid flight GPS and timestamps exist.",
      lastChecked: new Date().toISOString(),
    };
  }
}

export class MockWeatherProvider implements WeatherProvider {
  mode: WeatherMode = "mock";
  async getHistoricalWeatherForFlight(flight: FlightRecord) {
    return flight.telemetry.map((point, index) => mockSnapshot(point.timestamp, index));
  }
  async getForecastWindows(location: { latitude: number; longitude: number }) {
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(Date.now() + index * 2 * 60 * 60 * 1000);
      const snapshot = mockSnapshot(start.toISOString(), index + Math.abs(location.latitude + location.longitude));
      return {
        ...snapshot,
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      };
    });
  }
  getStatus(): WeatherProviderStatus {
    return {
      mode: "mock",
      available: true,
      label: "Mock weather mode",
      message: "Development-only mock weather is enabled and clearly separated from real Open-Meteo data.",
      lastChecked: new Date().toISOString(),
    };
  }
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  mode: WeatherMode = "open-meteo";
  async getHistoricalWeatherForFlight(flight: FlightRecord) {
    const first = flight.telemetry[0];
    if (!first) return [];
    const date = first.timestamp.slice(0, 10);
    const key = `historical:${first.latitude.toFixed(3)}:${first.longitude.toFixed(3)}:${date}`;
    const cached = cache.get(key) as WeatherSnapshot[] | undefined;
    if (cached) return cached;
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", String(first.latitude));
    url.searchParams.set("longitude", String(first.longitude));
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date", date);
    url.searchParams.set(
      "hourly",
      "temperature_2m,relative_humidity_2m,surface_pressure,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_speed_100m,wind_direction_10m,wind_direction_100m,wind_gusts_10m",
    );
    const data = await fetch(url).then((response) => response.json());
    const snapshots = normalizeOpenMeteoHourly(data);
    cacheWeatherResult(key, snapshots);
    return snapshots;
  }
  async getForecastWindows(location: { latitude: number; longitude: number }) {
    const key = `forecast:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`;
    const cached = cache.get(key) as WeatherWindow[] | undefined;
    if (cached) return cached;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("forecast_days", "2");
    url.searchParams.set(
      "hourly",
      "temperature_2m,relative_humidity_2m,surface_pressure,precipitation,precipitation_probability,weather_code,cloud_cover,visibility,wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_direction_10m,wind_direction_80m,wind_direction_120m,wind_gusts_10m",
    );
    const data = await fetch(url).then((response) => response.json());
    const windows = normalizeOpenMeteoHourly(data)
      .slice(0, 24)
      .map((snapshot) => ({
        ...snapshot,
        startTime: snapshot.timestamp,
        endTime: new Date(Date.parse(snapshot.timestamp) + 60 * 60 * 1000).toISOString(),
      }));
    cacheWeatherResult(key, windows);
    return windows;
  }
  getStatus(): WeatherProviderStatus {
    return {
      mode: "open-meteo",
      available: true,
      label: "Open-Meteo ready",
      message: "Open-Meteo requests are only made after uploaded flight GPS and timestamp data is available.",
      lastChecked: new Date().toISOString(),
    };
  }
}

export async function getHistoricalWeatherForFlight(flight: FlightRecord, mode: WeatherMode) {
  return getWeatherProvider(mode).getHistoricalWeatherForFlight(flight);
}

export async function getForecastWindows(location: { latitude: number; longitude: number }, mode: WeatherMode) {
  return getWeatherProvider(mode).getForecastWindows(location);
}

export function joinWeatherToTelemetry(telemetry: TelemetryPoint[], weather: WeatherSnapshot[]): TelemetryPoint[] {
  if (!weather.length) return telemetry;
  return telemetry.map((point) => {
    const closest = weather.reduce((best, snapshot) => {
      const delta = Math.abs(Date.parse(snapshot.timestamp) - Date.parse(point.timestamp));
      const bestDelta = Math.abs(Date.parse(best.timestamp) - Date.parse(point.timestamp));
      return delta < bestDelta ? snapshot : best;
    }, weather[0]);
    return { ...point, weather: closest };
  });
}

export function summarizeWeatherImpact(flight: FlightRecord, weather: WeatherSnapshot[]) {
  if (!weather.length) return "Wind impact can be calculated after weather is joined.";
  const winds = weather.map((snapshot) => snapshot.windSpeedKph).filter((value): value is number => value !== undefined);
  const avgWind = winds.length ? winds.reduce((sum, value) => sum + value, 0) / winds.length : undefined;
  if (avgWind === undefined) return "Weather was joined, but wind fields were unavailable.";
  if (avgWind > 18) return "Joined weather suggests wind may have reduced battery efficiency.";
  return "Joined weather suggests wind impact was modest for this flight.";
}

export function cacheWeatherResult(key: string, value: WeatherSnapshot[] | WeatherWindow[]) {
  cache.set(key, value);
}

export function getWeatherProviderStatus(mode: WeatherMode) {
  return getWeatherProvider(mode).getStatus();
}

function mockSnapshot(timestamp: string, seed: number): WeatherSnapshot {
  return {
    timestamp,
    temperatureCelsius: Math.round(16 + Math.sin(seed) * 6),
    windSpeedKph: Math.round(8 + Math.abs(Math.sin(seed * 0.8)) * 12),
    windGustKph: Math.round(14 + Math.abs(Math.cos(seed * 0.7)) * 14),
    windDirectionDegrees: Math.round((seed * 47) % 360),
    precipitationProbability: Math.round(Math.abs(Math.sin(seed * 0.25)) * 40),
    cloudCoverPercent: Math.round(25 + Math.abs(Math.cos(seed * 0.2)) * 55),
    visibilityMeters: 9000,
  };
}

function normalizeOpenMeteoHourly(data: {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    surface_pressure?: number[];
    wind_speed_10m?: number[];
    wind_speed_80m?: number[];
    wind_speed_100m?: number[];
    wind_speed_120m?: number[];
    wind_gusts_10m?: number[];
    wind_direction_10m?: number[];
    wind_direction_80m?: number[];
    wind_direction_100m?: number[];
    wind_direction_120m?: number[];
    precipitation?: number[];
    precipitation_probability?: number[];
    cloud_cover?: number[];
    visibility?: number[];
    weather_code?: number[];
  };
}) {
  const hourly = data.hourly;
  if (!hourly?.time) return [];
  return hourly.time.map((time, index) => ({
    timestamp: new Date(time).toISOString(),
    temperatureCelsius: hourly.temperature_2m?.[index],
    relativeHumidityPercent: hourly.relative_humidity_2m?.[index],
    surfacePressureHpa: hourly.surface_pressure?.[index],
    windSpeedKph: hourly.wind_speed_10m?.[index],
    windSpeed80mKph: hourly.wind_speed_80m?.[index],
    windSpeed100mKph: hourly.wind_speed_100m?.[index],
    windSpeed120mKph: hourly.wind_speed_120m?.[index],
    windGustKph: hourly.wind_gusts_10m?.[index],
    windDirectionDegrees: hourly.wind_direction_10m?.[index],
    windDirection80mDegrees: hourly.wind_direction_80m?.[index],
    windDirection100mDegrees: hourly.wind_direction_100m?.[index],
    windDirection120mDegrees: hourly.wind_direction_120m?.[index],
    precipitationMm: hourly.precipitation?.[index],
    precipitationProbability: hourly.precipitation_probability?.[index],
    cloudCoverPercent: hourly.cloud_cover?.[index],
    visibilityMeters: hourly.visibility?.[index],
    weatherCode: hourly.weather_code?.[index],
  }));
}
