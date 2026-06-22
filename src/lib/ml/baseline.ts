import type {
  Anomaly,
  BatteryPrediction,
  FlightRecord,
  ModelExplanation,
  RiskPrediction,
  TelemetryPoint,
  UserFlightProfile,
  WeatherWindow,
} from "@/types";
import { calculateFlyabilityScore, clamp, recommendFlightWindow } from "@/lib/analytics/metrics";

type FlightFeatures = {
  durationMinutes?: number;
  totalDistanceMeters?: number;
  altitudeGainMeters?: number;
  averageSpeedMps?: number;
  speedVariation?: number;
  hoverRatio?: number;
  batteryDrainHistory?: number;
  gpsSatellites?: number;
  signalStrength?: number;
  returnMargin?: number;
  windSpeedKph?: number;
  windGustKph?: number;
  temperatureCelsius?: number;
  precipitationProbability?: number;
};

export function buildFeaturesFromFlight(flight: FlightRecord): FlightFeatures {
  const speeds = flight.telemetry.map((point) => point.speedMps).filter((value): value is number => value !== undefined);
  const speedVariation = speeds.length > 2 ? Math.sqrt(speeds.reduce((sum, speed) => sum + (speed - average(speeds)) ** 2, 0) / speeds.length) : undefined;
  const satellites = flight.telemetry.map((point) => point.gpsSatellites).filter((value): value is number => value !== undefined);
  const signals = flight.telemetry.map((point) => point.signalStrengthPercent).filter((value): value is number => value !== undefined);
  const winds = flight.telemetry.map((point) => point.weather?.windSpeedKph).filter((value): value is number => value !== undefined);
  const altitudeWinds = flight.telemetry
    .map((point) => point.weather?.windSpeed100mKph ?? point.weather?.windSpeed80mKph ?? point.weather?.windSpeed120mKph)
    .filter((value): value is number => value !== undefined);
  const gusts = flight.telemetry.map((point) => point.weather?.windGustKph).filter((value): value is number => value !== undefined);
  const temps = flight.telemetry.map((point) => point.weather?.temperatureCelsius).filter((value): value is number => value !== undefined);
  const precip = flight.telemetry.map((point) => point.weather?.precipitationProbability).filter((value): value is number => value !== undefined);
  return {
    durationMinutes: flight.metrics.durationSeconds ? flight.metrics.durationSeconds / 60 : undefined,
    totalDistanceMeters: flight.metrics.totalDistanceMeters,
    altitudeGainMeters: flight.metrics.altitudeGainMeters,
    averageSpeedMps: flight.metrics.averageSpeedMps,
    speedVariation,
    hoverRatio: flight.metrics.hoverRatio,
    batteryDrainHistory: flight.metrics.batteryDrainPerMinute,
    gpsSatellites: satellites.length ? average(satellites) : undefined,
    signalStrength: signals.length ? average(signals) : undefined,
    returnMargin: flight.metrics.returnMargin,
    windSpeedKph: altitudeWinds.length ? average(altitudeWinds) : winds.length ? average(winds) : undefined,
    windGustKph: gusts.length ? average(gusts) : undefined,
    temperatureCelsius: temps.length ? average(temps) : undefined,
    precipitationProbability: precip.length ? average(precip) : undefined,
  };
}

export function predictBatteryUsage(features: FlightFeatures): BatteryPrediction {
  const missingFields = requiredMissing(features, ["durationMinutes", "totalDistanceMeters", "averageSpeedMps", "altitudeGainMeters"]);
  let estimate = 8;
  estimate += (features.durationMinutes ?? 8) * 1.35;
  estimate += ((features.totalDistanceMeters ?? 500) / 100) * 0.22;
  estimate += (features.altitudeGainMeters ?? 25) * 0.035;
  estimate += (features.speedVariation ?? 1.5) * 1.2;
  estimate += (features.hoverRatio ?? 0.15) * 7;
  estimate += Math.max(0, (features.windSpeedKph ?? 0) - 12) * 0.45;
  estimate += Math.max(0, (features.windGustKph ?? 0) - 18) * 0.28;
  estimate += (features.precipitationProbability ?? 0) * 0.08;
  if (features.temperatureCelsius !== undefined && features.temperatureCelsius < 3) estimate += 4;
  const confidence = missingFields.length <= 3 ? "medium" : "low";
  return {
    predictedBatteryUsePercent: Math.round(clamp(estimate, 1, 96)),
    estimatedSafeFlightMinutes: features.batteryDrainHistory ? Math.floor(70 / features.batteryDrainHistory) : undefined,
    confidence,
    explanation: "Baseline model estimate based on duration, route length, altitude gain, speed variation, hover ratio, signal, and joined weather when available.",
    missingFields,
  };
}

export function classifyFlightRisk(features: FlightFeatures): RiskPrediction {
  const missingFields = requiredMissing(features, ["returnMargin", "signalStrength", "gpsSatellites", "batteryDrainHistory"]);
  let score = 24;
  score += Math.max(0, (features.batteryDrainHistory ?? 1.4) - 1.5) * 12;
  score += (features.hoverRatio ?? 0.12) * 18;
  score += (features.speedVariation ?? 1) * 4;
  score += Math.max(0, 35 - (features.returnMargin ?? 35)) * 0.8;
  score += Math.max(0, 70 - (features.signalStrength ?? 80)) * 0.35;
  score += Math.max(0, 8 - (features.gpsSatellites ?? 12)) * 3;
  score += Math.max(0, (features.windGustKph ?? 0) - 20) * 1.1;
  score += (features.precipitationProbability ?? 0) * 0.16;
  const finalScore = Math.round(clamp(score));
  return {
    score: finalScore,
    riskClass: finalScore > 68 ? "high" : finalScore > 42 ? "medium" : "low",
    confidence: missingFields.length <= 3 ? "medium" : "low",
    explanation: "Baseline model estimate. Lower signal quality, higher drain, low return margin, gusts, and unstable movement increase estimated risk.",
    missingFields,
  };
}

export function detectFlightAnomalies(telemetry: TelemetryPoint[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  telemetry.forEach((point, index) => {
    const previous = telemetry[index - 1];
    if (previous?.batteryPercent !== undefined && point.batteryPercent !== undefined && previous.batteryPercent - point.batteryPercent > 8) {
      anomalies.push({
        id: `battery-drop-${index}`,
        label: "Rapid battery drop",
        severity: "warning",
        timestamp: point.timestamp,
        explanation: "Battery percentage fell faster than expected between adjacent telemetry points.",
      });
    }
    if (point.signalStrengthPercent !== undefined && point.signalStrengthPercent < 35) {
      anomalies.push({
        id: `signal-${index}`,
        label: "Low signal quality",
        severity: "caution",
        timestamp: point.timestamp,
        explanation: "Signal strength dropped below a conservative stability threshold.",
      });
    }
    if (point.speedMps !== undefined && point.speedMps > 14) {
      anomalies.push({
        id: `speed-${index}`,
        label: "High speed segment",
        severity: "info",
        timestamp: point.timestamp,
        explanation: "Speed is high for small-drone battery-efficiency planning.",
      });
    }
  });
  return anomalies.slice(0, 12);
}

export function rankFlightWindows(weatherWindows: WeatherWindow[], userFlightProfile: UserFlightProfile): WeatherWindow[] {
  const baselineRisk = userFlightProfile.averageRiskScore ?? 35;
  return weatherWindows
    .map((window) => {
      const flyabilityScore = calculateFlyabilityScore(window, baselineRisk);
      return { ...window, flyabilityScore, recommendation: recommendFlightWindow(flyabilityScore) };
    })
    .sort((a, b) => (b.flyabilityScore ?? 0) - (a.flyabilityScore ?? 0));
}

export function explainPrediction(features: FlightFeatures, prediction: BatteryPrediction | RiskPrediction): ModelExplanation {
  const factors = [
    features.speedVariation !== undefined ? "Higher speed variation increased estimated battery drain." : "Speed variation can be included after speed data is uploaded.",
    features.altitudeGainMeters !== undefined ? "Altitude gain increased energy demand." : "Altitude gain can be included after altitude data is uploaded.",
    features.signalStrength !== undefined ? "Signal quality informed the risk score." : "Signal stability can be included after signal or satellite fields are uploaded.",
    features.windSpeedKph !== undefined ? "Wind speed adjusted the weather impact estimate." : "Wind speed can be included after weather is joined.",
  ];
  return {
    title: "Baseline model estimate",
    output: "riskClass" in prediction ? `${prediction.riskClass} risk, ${prediction.score}/100` : `${prediction.predictedBatteryUsePercent}% predicted battery use`,
    confidence: prediction.confidence,
    factors,
    missingFields: prediction.missingFields,
  };
}

export function calculateFeatureImportance(flights: FlightRecord[]) {
  if (!flights.length) return [];
  return [
    { feature: "Flight duration", value: 86 },
    { feature: "Altitude gain", value: hasAny(flights, "altitudeGainMeters") ? 72 : 0 },
    { feature: "Average speed", value: hasAny(flights, "averageSpeedMps") ? 64 : 0 },
    { feature: "Speed variation", value: flights.some((flight) => flight.featureAvailability.speedChart) ? 55 : 0 },
    { feature: "Distance from home", value: flights.some((flight) => flight.featureAvailability.distanceChart) ? 48 : 0 },
    { feature: "GPS/signal quality", value: flights.some((flight) => flight.featureAvailability.signalStability) ? 45 : 0 },
    { feature: "Hover ratio", value: hasAny(flights, "hoverRatio") ? 42 : 0 },
    { feature: "Wind speed", value: flights.some((flight) => flight.weatherJoined) ? 58 : 0 },
  ].filter((item) => item.value > 0);
}

export function buildUserFlightProfile(flights: FlightRecord[]): UserFlightProfile {
  return {
    flightCount: flights.length,
    averageBatteryDrainPerMinute: avgMetric(flights, "batteryDrainPerMinute"),
    averageSpeedMps: avgMetric(flights, "averageSpeedMps"),
    averageHoverRatio: avgMetric(flights, "hoverRatio"),
    averageRiskScore: avgMetric(flights, "riskScore"),
    typicalDistanceMeters: avgMetric(flights, "totalDistanceMeters"),
  };
}

function avgMetric(flights: FlightRecord[], key: keyof FlightRecord["metrics"]) {
  const values = flights.map((flight) => flight.metrics[key]).filter((value): value is number => typeof value === "number");
  return values.length ? average(values) : undefined;
}

function hasAny(flights: FlightRecord[], key: keyof FlightRecord["metrics"]) {
  return flights.some((flight) => flight.metrics[key] !== undefined);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function requiredMissing(features: FlightFeatures, keys: Array<keyof FlightFeatures>) {
  return keys.filter((key) => features[key] === undefined);
}
