import type { TelemetryPoint } from "@/types";

export function findFirstAltitudeAnomalyIndex(telemetry: TelemetryPoint[]) {
  return telemetry.findIndex((point, index) => isUnreliableAltitudePoint(point, telemetry[index - 1]));
}

export function isUnreliableAltitudePoint(point?: TelemetryPoint, previous?: TelemetryPoint) {
  if (!point || point.altitudeMeters === undefined) return false;

  const previousAltitude = previous?.altitudeMeters;
  const gpsLost = point.gpsSatellites !== undefined && point.gpsSatellites <= 3;
  const verticalSpike = point.verticalSpeedMps !== undefined && Math.abs(point.verticalSpeedMps) > 15;
  const physicallyImpossibleLow = point.altitudeMeters < -20;
  const sharpAltitudeDrop = previousAltitude !== undefined && previousAltitude - point.altitudeMeters > 30;

  return (physicallyImpossibleLow || sharpAltitudeDrop) && (gpsLost || verticalSpike || point.altitudeMeters < -50);
}

export function isReliablePositionPoint(point?: TelemetryPoint) {
  if (!point) return false;
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
  if (point.gpsSatellites !== undefined && point.gpsSatellites <= 3) return false;
  return true;
}

export function isReliableAltitudePoint(point?: TelemetryPoint, previous?: TelemetryPoint) {
  if (!point || point.altitudeMeters === undefined) return false;
  return !isUnreliableAltitudePoint(point, previous);
}

export function getTelemetryQualityWarning(point?: TelemetryPoint, previous?: TelemetryPoint) {
  if (!point) return undefined;
  if (isUnreliableAltitudePoint(point, previous)) {
    return "Altitude and GPS are inconsistent at this point. Treat this as unreliable log data, often caused by GPS loss, ATTI mode, impact, or post-crash recording.";
  }
  if (point.gpsSatellites !== undefined && point.gpsSatellites <= 3) {
    return "GPS lock is weak or lost at this point, so position and movement estimates may be less reliable.";
  }
  return undefined;
}

export function getAltitudeReferenceNote(point?: TelemetryPoint, previous?: TelemetryPoint) {
  if (!point || point.altitudeMeters === undefined || point.altitudeMeters >= 0) return undefined;
  if (isUnreliableAltitudePoint(point, previous)) return undefined;
  return "Altitude is below the takeoff/home reference here. Small negative values can happen in DJI logs from barometric drift, terrain changes, or relative-height calibration, so this is not treated as an ML anomaly by itself.";
}
