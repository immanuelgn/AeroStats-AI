import type { FlightRecord, ParserResult } from "@/types";
import { deriveFlightMetrics } from "@/lib/analytics/metrics";

export type BackendHealth = {
  ok: boolean;
  service?: string;
  supabaseConfigured?: boolean;
  storageStrategy?: string;
  coldStartNote?: string;
};

export type BackendModelStatus = {
  backend: string;
  supabaseConfigured: boolean;
  modelArtifactStorage: string;
  latestModelRuns: Array<Record<string, unknown>>;
  loadedArtifacts: string[];
  honestyNote: string;
};

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

export function isBackendConfigured() {
  return Boolean(apiBaseUrl);
}

export async function getBackendHealth(): Promise<BackendHealth> {
  return apiFetch<BackendHealth>("/health");
}

export async function getModelStatus(): Promise<BackendModelStatus> {
  return apiFetch<BackendModelStatus>("/model/status");
}

export async function uploadFlightToBackend(file: File, normalizedTelemetry?: FlightRecord["telemetry"]): Promise<{ parser: ParserResult; flights: FlightRecord[] }> {
  const form = new FormData();
  form.append("file", file);
  if (normalizedTelemetry?.length) form.append("normalizedTelemetry", JSON.stringify(normalizedTelemetry));
  const response = await apiFetch<{ parser: Record<string, unknown>; flights: Array<Record<string, unknown>> }>("/upload/flight", { method: "POST", body: form });
  const flights = ((response.parser.flights as Array<Record<string, unknown>> | undefined) ?? response.flights ?? []).map(normalizeBackendFlight);
  const parser = normalizeBackendParser(response.parser, flights);
  return { parser, flights };
}

export async function trainModels(model: "all" | "battery" | "risk" | "anomaly" = "all") {
  return apiFetch<{ runs?: Record<string, unknown>; run?: Record<string, unknown> }>("/ml/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, maxRows: 5000 }),
  });
}

export async function joinWeatherBackend(flightId: string) {
  return apiFetch<Record<string, unknown>>(`/weather/join/${flightId}`, { method: "POST" });
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error("Backend API is not configured. Set NEXT_PUBLIC_API_BASE_URL.");
  }
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      const detail = parsed?.detail;
      throw new Error(typeof detail === "string" ? detail : detail?.message ?? `Backend request failed with ${response.status}`);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text || `Backend request failed with ${response.status}`);
      throw error;
    }
  }
  const payload = await response.json();
  if (payload?.ok === false) throw new Error(payload.error ?? "Backend request failed.");
  return payload;
}

function normalizeBackendParser(raw: Record<string, unknown>, flights: FlightRecord[]): ParserResult {
  const allTelemetry = flights.flatMap((flight) => flight.telemetry);
  return {
    status: String(raw.status ?? "success") as ParserResult["status"],
    detectedFlights: Number(raw.detectedFlights ?? flights.length),
    telemetryPoints: Number(raw.telemetryPoints ?? allTelemetry.length),
    hasGps: allTelemetry.some((point) => point.latitude !== undefined && point.longitude !== undefined),
    hasBattery: allTelemetry.some((point) => point.batteryPercent !== undefined),
    hasAltitude: allTelemetry.some((point) => point.altitudeMeters !== undefined),
    hasSpeed: allTelemetry.some((point) => point.speedMps !== undefined),
    hasSignal: allTelemetry.some((point) => point.gpsSatellites !== undefined || point.signalStrengthPercent !== undefined),
    parserConfidence: Number(raw.parserConfidence ?? 0),
    missingFields: (raw.missingFields as string[] | undefined) ?? [],
    warnings: ((raw.warnings as string[] | undefined) ?? []).map((message, index) => ({ code: `backend-${index}`, message, severity: "warning" })),
    nextRecommendedAction: String(raw.nextRecommendedAction ?? "Open the flight library or train models."),
    flights,
  };
}

function normalizeBackendFlight(raw: Record<string, unknown>): FlightRecord {
  const telemetry = ((raw.telemetry as Array<Record<string, unknown>> | undefined) ?? []).map((point) => ({
    timestamp: String(point.timestamp),
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
    altitudeMeters: optionalNumber(point.altitudeMeters),
    speedMps: optionalNumber(point.speedMps),
    batteryPercent: optionalNumber(point.batteryPercent),
    distanceFromHomeMeters: optionalNumber(point.distanceFromHomeMeters),
    headingDegrees: optionalNumber(point.headingDegrees),
    verticalSpeedMps: optionalNumber(point.verticalSpeedMps),
    gpsSatellites: optionalNumber(point.gpsSatellites),
    signalStrengthPercent: optionalNumber(point.signalStrengthPercent),
    eventType: point.eventType ? String(point.eventType) : undefined,
    weather: point.weather as FlightRecord["telemetry"][number]["weather"],
  }));
  const backendMetrics = (raw.metrics ?? {}) as Record<string, unknown>;
  const derivedMetrics = deriveFlightMetrics(telemetry);
  const metrics: FlightRecord["metrics"] = {
    ...derivedMetrics,
    batteryDrainPer100Meters: optionalNumber(backendMetrics.batteryDrainPer100Meters ?? backendMetrics.batteryDrainPer100m) ?? derivedMetrics.batteryDrainPer100Meters,
    returnMargin: optionalNumber(backendMetrics.returnMargin ?? backendMetrics.returnMarginScore) ?? derivedMetrics.returnMargin,
  };
  const startedAt = String(raw.startedAt ?? telemetry[0]?.timestamp ?? new Date().toISOString());
  const endedAt = String(raw.endedAt ?? telemetry[telemetry.length - 1]?.timestamp ?? startedAt);
  return {
    id: String(raw.id),
    name: String(raw.name ?? "Imported flight"),
    sourceFileName: String(raw.sourceFilename ?? raw.sourceFileName ?? "upload"),
    importedAt: new Date().toISOString(),
    metadata: {
      startTime: startedAt,
      endTime: endedAt,
      locationLabel: raw.locationName ? String(raw.locationName) : telemetry[0] ? `${telemetry[0].latitude.toFixed(4)}, ${telemetry[0].longitude.toFixed(4)}` : undefined,
      parserConfidence: Number(raw.parserConfidence ?? 0),
      pointCount: telemetry.length,
    },
    telemetry,
    metrics,
    events: (raw.events as FlightRecord["events"] | undefined) ?? [],
    tags: (raw.tags as string[] | undefined) ?? ["Backend parsed"],
    featureAvailability: (raw.featureAvailability as FlightRecord["featureAvailability"] | undefined) ?? {
      mapPath: telemetry.length > 0,
      replay: telemetry.length > 0,
      batteryAnalytics: telemetry.some((point) => point.batteryPercent !== undefined),
      altitudeChart: telemetry.some((point) => point.altitudeMeters !== undefined),
      speedChart: telemetry.some((point) => point.speedMps !== undefined),
      distanceChart: telemetry.some((point) => point.distanceFromHomeMeters !== undefined),
      signalStability: telemetry.some((point) => point.gpsSatellites !== undefined || point.signalStrengthPercent !== undefined),
      weatherJoin: telemetry.length > 0,
      forecast: telemetry.length > 0,
      mlBatteryPrediction: telemetry.some((point) => point.batteryPercent !== undefined),
    },
    weatherJoined: telemetry.some((point) => point.weather),
  };
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
