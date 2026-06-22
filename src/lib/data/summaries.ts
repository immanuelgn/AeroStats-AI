import type { FlightRecord } from "@/types";

export function latestFlight(flights: FlightRecord[]) {
  return [...flights].sort((a, b) => Date.parse(b.metadata.startTime ?? b.importedAt) - Date.parse(a.metadata.startTime ?? a.importedAt))[0];
}

export function dashboardMetrics(flights: FlightRecord[]) {
  const totalDistance = sumMetric(flights, "totalDistanceMeters");
  const avgDuration = avgMetric(flights, "durationSeconds");
  const avgBatteryDrain = avgMetric(flights, "batteryDrainPerMinute");
  const avgRisk = avgMetric(flights, "riskScore");
  const bestEfficiency = [...flights]
    .filter((flight) => flight.metrics.batteryDrainPer100Meters !== undefined)
    .sort((a, b) => (a.metrics.batteryDrainPer100Meters ?? 99) - (b.metrics.batteryDrainPer100Meters ?? 99))[0];
  const totalBatteryUsed = sumMetric(flights, "batteryUsedPercent");
  const totalTelemetryPoints = flights.reduce((sum, flight) => sum + flight.telemetry.length, 0);
  const weatherJoinedCount = flights.filter((flight) => flight.weatherJoined).length;
  return { totalDistance, avgDuration, avgBatteryDrain, avgRisk, bestEfficiency, latest: latestFlight(flights), totalBatteryUsed, totalTelemetryPoints, weatherJoinedCount };
}

export function flightDisplayName(flight: FlightRecord, index?: number) {
  const date = flight.metadata.startTime ? new Date(flight.metadata.startTime) : undefined;
  const dateLabel = date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : undefined;
  return dateLabel ? `Flight ${index !== undefined ? index + 1 : ""} · ${dateLabel}`.replace("Flight  ·", "Flight ·") : flight.name;
}

function sumMetric(flights: FlightRecord[], key: keyof FlightRecord["metrics"]) {
  const values = flights.map((flight) => flight.metrics[key]).filter((value): value is number => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

function avgMetric(flights: FlightRecord[], key: keyof FlightRecord["metrics"]) {
  const values = flights.map((flight) => flight.metrics[key]).filter((value): value is number => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}
