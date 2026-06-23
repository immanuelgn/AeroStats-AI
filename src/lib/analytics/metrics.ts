import type { FlightMetrics, TelemetryPoint, WeatherWindow, FlyabilityRecommendation } from "@/types";
import { isReliableAltitudePoint, isReliablePositionPoint } from "@/lib/data/quality";

const EARTH_RADIUS_METERS = 6371000;

export function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function formatDuration(seconds?: number) {
  if (seconds === undefined) return "Upload required";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatDistance(meters?: number) {
  if (meters === undefined) return "Upload required";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function haversineDistance(a: TelemetryPoint, b: TelemetryPoint) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function calculateTotalDistance(telemetry: TelemetryPoint[]) {
  return telemetry.slice(1).reduce((sum, point, index) => {
    const previous = telemetry[index];
    if (!isReliablePositionPoint(previous) || !isReliablePositionPoint(point)) return sum;
    return sum + haversineDistance(previous, point);
  }, 0);
}

export function calculateFlightDuration(telemetry: TelemetryPoint[]) {
  if (telemetry.length < 2) return undefined;
  const start = Date.parse(telemetry[0].timestamp);
  const end = Date.parse(telemetry[telemetry.length - 1].timestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  return (end - start) / 1000;
}

export function calculateBatteryUsed(telemetry: TelemetryPoint[]) {
  const values = telemetry.map((point) => point.batteryPercent).filter((value): value is number => value !== undefined);
  if (values.length < 2) return undefined;
  return Math.max(0, values[0] - values[values.length - 1]);
}

export function calculateAverageSpeed(telemetry: TelemetryPoint[], totalDistance?: number, duration?: number) {
  const speeds = telemetry.map((point) => point.speedMps).filter((value): value is number => value !== undefined);
  if (speeds.length) return speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
  if (totalDistance !== undefined && duration && duration > 0) return totalDistance / duration;
  return undefined;
}

export function calculateMaxSpeed(telemetry: TelemetryPoint[]) {
  const speeds = telemetry.map((point) => point.speedMps).filter((value): value is number => value !== undefined);
  return speeds.length ? Math.max(...speeds) : undefined;
}

export function calculateMaxAltitude(telemetry: TelemetryPoint[]) {
  const altitudes = telemetry
    .filter((point, index) => isReliableAltitudePoint(point, telemetry[index - 1]))
    .map((point) => point.altitudeMeters)
    .filter((value): value is number => value !== undefined);
  return altitudes.length ? Math.max(...altitudes) : undefined;
}

export function calculateAltitudeGain(telemetry: TelemetryPoint[]) {
  let gain = 0;
  for (let index = 1; index < telemetry.length; index += 1) {
    if (!isReliableAltitudePoint(telemetry[index - 1], telemetry[index - 2]) || !isReliableAltitudePoint(telemetry[index], telemetry[index - 1])) continue;
    const previous = telemetry[index - 1].altitudeMeters;
    const current = telemetry[index].altitudeMeters;
    if (previous !== undefined && current !== undefined && current > previous) gain += current - previous;
  }
  return gain || undefined;
}

export function calculateHoverRatio(telemetry: TelemetryPoint[]) {
  const speeds = telemetry.map((point) => point.speedMps).filter((value): value is number => value !== undefined);
  if (!speeds.length) return undefined;
  return speeds.filter((speed) => speed < 0.8).length / speeds.length;
}

export function calculateBatteryDrainPerMinute(batteryUsed?: number, durationSeconds?: number) {
  if (batteryUsed === undefined || !durationSeconds) return undefined;
  return batteryUsed / (durationSeconds / 60);
}

export function calculateBatteryDrainPer100Meters(batteryUsed?: number, totalDistance?: number) {
  if (batteryUsed === undefined || !totalDistance) return undefined;
  return (batteryUsed / totalDistance) * 100;
}

export function calculateRouteEfficiency(telemetry: TelemetryPoint[], totalDistance?: number) {
  if (telemetry.length < 2 || !totalDistance) return undefined;
  const reliableTelemetry = telemetry.filter(isReliablePositionPoint);
  if (reliableTelemetry.length < 2) return undefined;
  const directDistance = haversineDistance(reliableTelemetry[0], reliableTelemetry[reliableTelemetry.length - 1]);
  if (totalDistance < 1) return undefined;
  return clamp((directDistance / totalDistance) * 100);
}

export function calculateAggressiveMovementScore(telemetry: TelemetryPoint[]) {
  const speeds = telemetry.map((point) => point.speedMps).filter((value): value is number => value !== undefined);
  if (speeds.length < 3) return undefined;
  const changes = speeds.slice(1).map((speed, index) => Math.abs(speed - speeds[index]));
  const avgChange = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  return clamp(avgChange * 18);
}

export function calculateReturnMargin(telemetry: TelemetryPoint[]) {
  const distance = [...telemetry].reverse().find(isReliablePositionPoint)?.distanceFromHomeMeters;
  const battery = telemetry[telemetry.length - 1]?.batteryPercent;
  if (distance === undefined || battery === undefined) return undefined;
  return clamp(battery - distance / 120);
}

export function calculateWindImpactScore(telemetry: TelemetryPoint[]) {
  const winds = telemetry
    .map((point) => point.weather?.windSpeed100mKph ?? point.weather?.windSpeed80mKph ?? point.weather?.windSpeed120mKph ?? point.weather?.windSpeedKph)
    .filter((value): value is number => value !== undefined);
  if (!winds.length) return undefined;
  return clamp((winds.reduce((sum, value) => sum + value, 0) / winds.length) * 3);
}

export function calculateSignalStabilityScore(telemetry: TelemetryPoint[]) {
  const signalValues = telemetry
    .map((point) => point.signalStrengthPercent)
    .filter((value): value is number => value !== undefined);
  if (signalValues.length) return clamp(signalValues.reduce((sum, value) => sum + value, 0) / signalValues.length);
  const satellites = telemetry.map((point) => point.gpsSatellites).filter((value): value is number => value !== undefined);
  if (!satellites.length) return undefined;
  return clamp((satellites.reduce((sum, value) => sum + value, 0) / satellites.length / 18) * 100);
}

export function calculateRiskScore(metrics: FlightMetrics) {
  let score = 18;
  if (metrics.batteryDrainPerMinute !== undefined) score += clamp((metrics.batteryDrainPerMinute - 1.4) * 14, 0, 25);
  if (metrics.hoverRatio !== undefined) score += metrics.hoverRatio * 14;
  if (metrics.aggressiveMovementScore !== undefined) score += metrics.aggressiveMovementScore * 0.18;
  if (metrics.returnMargin !== undefined) score += clamp(40 - metrics.returnMargin, 0, 24);
  if (metrics.signalStabilityScore !== undefined) score += clamp(78 - metrics.signalStabilityScore, 0, 20);
  if (metrics.windImpactScore !== undefined) score += metrics.windImpactScore * 0.2;
  return Math.round(clamp(score));
}

export function calculateFlyabilityScore(window: WeatherWindow, baselineRisk = 35) {
  let score = 92 - baselineRisk * 0.25;
  const altitudeWind = window.windSpeed80mKph ?? window.windSpeed100mKph ?? window.windSpeed120mKph ?? window.windSpeedKph;
  if (altitudeWind !== undefined) score -= Math.max(0, altitudeWind - 10) * 1.8;
  if (window.windGustKph !== undefined) score -= Math.max(0, window.windGustKph - 16) * 1.4;
  if (window.precipitationProbability !== undefined) score -= window.precipitationProbability * 0.45;
  if (window.visibilityMeters !== undefined && window.visibilityMeters < 5000) score -= 18;
  if (window.temperatureCelsius !== undefined) {
    if (window.temperatureCelsius < 2) score -= 14;
    if (window.temperatureCelsius > 32) score -= 8;
  }
  return Math.round(clamp(score));
}

export function recommendFlightWindow(score: number): FlyabilityRecommendation {
  if (score >= 82) return { label: "Best", reason: "Calm conditions and strong estimated flight margin." };
  if (score >= 66) return { label: "Good", reason: "Usable conditions with ordinary preflight checks." };
  if (score >= 45) return { label: "Caution", reason: "Conditions may reduce stability or battery efficiency." };
  return { label: "Avoid", reason: "Estimated conditions are unfavorable for a small drone." };
}

export function deriveFlightMetrics(telemetry: TelemetryPoint[]): FlightMetrics {
  const totalDistanceMeters = calculateTotalDistance(telemetry);
  const durationSeconds = calculateFlightDuration(telemetry);
  const batteryUsedPercent = calculateBatteryUsed(telemetry);
  const averageSpeedMps = calculateAverageSpeed(telemetry, totalDistanceMeters, durationSeconds);
  const metrics: FlightMetrics = {
    totalDistanceMeters,
    durationSeconds,
    batteryUsedPercent,
    averageSpeedMps,
    maxSpeedMps: calculateMaxSpeed(telemetry),
    maxAltitudeMeters: calculateMaxAltitude(telemetry),
    altitudeGainMeters: calculateAltitudeGain(telemetry),
    hoverRatio: calculateHoverRatio(telemetry),
    batteryDrainPerMinute: calculateBatteryDrainPerMinute(batteryUsedPercent, durationSeconds),
    batteryDrainPer100Meters: calculateBatteryDrainPer100Meters(batteryUsedPercent, totalDistanceMeters),
    routeEfficiency: calculateRouteEfficiency(telemetry, totalDistanceMeters),
    aggressiveMovementScore: calculateAggressiveMovementScore(telemetry),
    returnMargin: calculateReturnMargin(telemetry),
    windImpactScore: calculateWindImpactScore(telemetry),
    signalStabilityScore: calculateSignalStabilityScore(telemetry),
  };
  metrics.riskScore = calculateRiskScore(metrics);
  return metrics;
}
