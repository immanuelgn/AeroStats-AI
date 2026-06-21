import type { FlightEvent, FlightRecord, TelemetryPoint } from "@/types";

export function generateFlightEvents(telemetry: TelemetryPoint[]): FlightEvent[] {
  if (!telemetry.length) return [];
  const events: FlightEvent[] = [
    {
      id: "takeoff",
      type: "takeoff",
      label: "Takeoff",
      timestamp: telemetry[0].timestamp,
      telemetryIndex: 0,
      severity: "info",
      description: "First telemetry point in the imported flight.",
    },
  ];

  const gpsIndex = telemetry.findIndex((point) => (point.gpsSatellites ?? 0) >= 8);
  if (gpsIndex >= 0) {
    events.push({
      id: "gps-lock",
      type: "gps-lock",
      label: "GPS lock",
      timestamp: telemetry[gpsIndex].timestamp,
      telemetryIndex: gpsIndex,
      severity: "info",
      description: "Satellite count indicates stable GPS availability.",
    });
  }

  addPeakEvent(events, telemetry, "altitudeMeters", "peak-altitude", "Peak altitude", "Highest altitude in the flight.");
  addPeakEvent(events, telemetry, "distanceFromHomeMeters", "max-distance", "Max distance", "Farthest distance from home point.");

  const hoverIndex = telemetry.findIndex((point) => point.speedMps !== undefined && point.speedMps < 0.8);
  if (hoverIndex >= 0) {
    events.push({
      id: "hover-heavy",
      type: "hover-heavy",
      label: "Hover-heavy segment",
      timestamp: telemetry[hoverIndex].timestamp,
      telemetryIndex: hoverIndex,
      severity: "caution",
      description: "Low-speed telemetry suggests hovering or station keeping.",
    });
  }

  const batteryIndex = telemetry.findIndex((point) => point.batteryPercent !== undefined && point.batteryPercent <= 30);
  if (batteryIndex >= 0) {
    events.push({
      id: "battery-warning",
      type: "battery-warning",
      label: "Battery threshold",
      timestamp: telemetry[batteryIndex].timestamp,
      telemetryIndex: batteryIndex,
      severity: "warning",
      description: "Battery crossed the 30 percent decision-support threshold.",
    });
  }

  const lowSignalIndex = telemetry.findIndex(
    (point) =>
      (point.signalStrengthPercent !== undefined && point.signalStrengthPercent < 45) ||
      (point.gpsSatellites !== undefined && point.gpsSatellites < 7),
  );
  if (lowSignalIndex >= 0) {
    events.push({
      id: "low-signal",
      type: "low-signal",
      label: "Low signal segment",
      timestamp: telemetry[lowSignalIndex].timestamp,
      telemetryIndex: lowSignalIndex,
      severity: "caution",
      description: "Signal or satellite count dipped below a stability threshold.",
    });
  }

  const windIndex = telemetry.findIndex((point) => (point.weather?.windSpeedKph ?? 0) >= 18);
  if (windIndex >= 0) {
    events.push({
      id: "wind-affected",
      type: "wind-affected",
      label: "Wind-affected segment",
      timestamp: telemetry[windIndex].timestamp,
      telemetryIndex: windIndex,
      severity: "caution",
      description: "Joined weather indicates wind may have affected efficiency.",
    });
  }

  events.push({
    id: "landing",
    type: "landing",
    label: "Landing",
    timestamp: telemetry[telemetry.length - 1].timestamp,
    telemetryIndex: telemetry.length - 1,
    severity: "info",
    description: "Final telemetry point in the imported flight.",
  });

  return events
    .filter((event, index, list) => list.findIndex((candidate) => candidate.id === event.id) === index)
    .sort((a, b) => a.telemetryIndex - b.telemetryIndex);
}

function addPeakEvent(
  events: FlightEvent[],
  telemetry: TelemetryPoint[],
  key: "altitudeMeters" | "distanceFromHomeMeters",
  type: FlightEvent["type"],
  label: string,
  description: string,
) {
  let bestIndex = -1;
  let bestValue = -Infinity;
  telemetry.forEach((point, index) => {
    const value = point[key];
    if (value !== undefined && value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  });
  if (bestIndex >= 0) {
    events.push({
      id: type,
      type,
      label,
      timestamp: telemetry[bestIndex].timestamp,
      telemetryIndex: bestIndex,
      severity: "info",
      description,
    });
  }
}

export function generateFlightTags(flight: Pick<FlightRecord, "metrics" | "featureAvailability">): string[] {
  const tags: string[] = [];
  if ((flight.metrics.windImpactScore ?? 0) > 45) tags.push("Wind affected");
  if ((flight.metrics.batteryDrainPer100Meters ?? 99) < 1.8 && (flight.metrics.routeEfficiency ?? 0) > 65) tags.push("Efficient cruise");
  if ((flight.metrics.hoverRatio ?? 0) > 0.35) tags.push("Hover-heavy");
  if ((flight.metrics.batteryDrainPerMinute ?? 0) > 2.5) tags.push("High battery drain");
  if ((flight.metrics.signalStabilityScore ?? 100) < 60) tags.push("Low signal segment");
  if (!tags.length) tags.push("Telemetry baseline");
  return tags;
}
