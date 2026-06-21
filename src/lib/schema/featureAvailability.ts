import type { FeatureAvailability, TelemetryPoint } from "@/types";

const has = (telemetry: TelemetryPoint[], key: keyof TelemetryPoint) =>
  telemetry.some((point) => point[key] !== undefined && point[key] !== null);

export function getFeatureAvailability(telemetry: TelemetryPoint[]): FeatureAvailability {
  const hasTimestamp = has(telemetry, "timestamp");
  const hasLat = has(telemetry, "latitude");
  const hasLon = has(telemetry, "longitude");
  const hasGps = hasLat && hasLon;
  return {
    mapPath: hasGps,
    replay: hasTimestamp && hasGps,
    batteryAnalytics: has(telemetry, "batteryPercent"),
    altitudeChart: has(telemetry, "altitudeMeters"),
    speedChart: has(telemetry, "speedMps"),
    distanceChart: has(telemetry, "distanceFromHomeMeters"),
    signalStability: has(telemetry, "gpsSatellites") || has(telemetry, "signalStrengthPercent"),
    weatherJoin: hasTimestamp && hasGps,
    forecast: hasTimestamp && hasGps,
    mlBatteryPrediction:
      has(telemetry, "batteryPercent") &&
      hasTimestamp &&
      hasGps &&
      (has(telemetry, "altitudeMeters") || has(telemetry, "speedMps")),
  };
}

export function missingRecommendedFields(telemetry: TelemetryPoint[]) {
  const fields: Array<keyof TelemetryPoint> = [
    "altitudeMeters",
    "speedMps",
    "batteryPercent",
    "headingDegrees",
    "distanceFromHomeMeters",
    "gpsSatellites",
    "signalStrengthPercent",
  ];
  return fields.filter((field) => !has(telemetry, field));
}
