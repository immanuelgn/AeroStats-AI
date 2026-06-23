export type WeatherMode = "disabled" | "mock" | "open-meteo";

export type RiskLevel = "low" | "medium" | "high";

export type ParserStatus =
  | "idle"
  | "validating"
  | "parsing"
  | "normalizing"
  | "deriving metrics"
  | "success"
  | "unsupported file"
  | "invalid telemetry structure"
  | "partially parsed"
  | "parse failed";

export type TelemetryPoint = {
  timestamp: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  speedMps?: number;
  batteryPercent?: number;
  distanceFromHomeMeters?: number;
  headingDegrees?: number;
  verticalSpeedMps?: number;
  gpsSatellites?: number;
  signalStrengthPercent?: number;
  eventType?: string;
  weather?: WeatherSnapshot;
};

export type FlightEvent = {
  id: string;
  type:
    | "takeoff"
    | "gps-lock"
    | "peak-altitude"
    | "max-distance"
    | "hover-heavy"
    | "battery-warning"
    | "landing"
    | "low-signal"
    | "wind-affected"
    | "telemetry-anomaly";
  label: string;
  timestamp: string;
  telemetryIndex: number;
  severity: "info" | "caution" | "warning";
  description?: string;
};

export type WeatherSnapshot = {
  timestamp: string;
  temperatureCelsius?: number;
  relativeHumidityPercent?: number;
  surfacePressureHpa?: number;
  windSpeedKph?: number;
  windSpeed80mKph?: number;
  windSpeed100mKph?: number;
  windSpeed120mKph?: number;
  windGustKph?: number;
  windDirectionDegrees?: number;
  windDirection80mDegrees?: number;
  windDirection100mDegrees?: number;
  windDirection120mDegrees?: number;
  precipitationMm?: number;
  precipitationProbability?: number;
  cloudCoverPercent?: number;
  visibilityMeters?: number;
  weatherCode?: number;
};

export type WeatherWindow = WeatherSnapshot & {
  startTime: string;
  endTime: string;
  flyabilityScore?: number;
  recommendation?: FlyabilityRecommendation;
};

export type FlyabilityRecommendation = {
  label: "Best" | "Good" | "Caution" | "Avoid";
  reason: string;
};

export type FlightMetrics = {
  totalDistanceMeters?: number;
  durationSeconds?: number;
  batteryUsedPercent?: number;
  averageSpeedMps?: number;
  maxSpeedMps?: number;
  maxAltitudeMeters?: number;
  altitudeGainMeters?: number;
  hoverRatio?: number;
  batteryDrainPerMinute?: number;
  batteryDrainPer100Meters?: number;
  routeEfficiency?: number;
  aggressiveMovementScore?: number;
  returnMargin?: number;
  windImpactScore?: number;
  signalStabilityScore?: number;
  riskScore?: number;
};

export type FeatureAvailability = {
  mapPath: boolean;
  replay: boolean;
  batteryAnalytics: boolean;
  altitudeChart: boolean;
  speedChart: boolean;
  distanceChart: boolean;
  signalStability: boolean;
  weatherJoin: boolean;
  forecast: boolean;
  mlBatteryPrediction: boolean;
};

export type FlightRecord = {
  id: string;
  name: string;
  sourceFileName: string;
  importedAt: string;
  metadata: {
    startTime?: string;
    endTime?: string;
    locationLabel?: string;
    parserConfidence: number;
    pointCount: number;
  };
  telemetry: TelemetryPoint[];
  metrics: FlightMetrics;
  events: FlightEvent[];
  tags: string[];
  featureAvailability: FeatureAvailability;
  weatherJoined?: boolean;
};

export type RiskPrediction = {
  riskClass: RiskLevel;
  score: number;
  confidence: "low" | "medium" | "high";
  explanation: string;
  missingFields: string[];
};

export type BatteryPrediction = {
  predictedBatteryUsePercent: number;
  estimatedSafeFlightMinutes?: number;
  confidence: "low" | "medium" | "high";
  explanation: string;
  missingFields: string[];
};

export type Anomaly = {
  id: string;
  label: string;
  severity: "info" | "caution" | "warning";
  timestamp?: string;
  explanation: string;
};

export type ModelExplanation = {
  title: string;
  output: string;
  confidence: "low" | "medium" | "high";
  factors: string[];
  missingFields: string[];
};

export type ParserWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type ParserResult = {
  status: ParserStatus;
  detectedFlights: number;
  telemetryPoints: number;
  dateRange?: { start: string; end: string };
  hasGps: boolean;
  hasBattery: boolean;
  hasAltitude: boolean;
  hasSpeed: boolean;
  hasSignal: boolean;
  parserConfidence: number;
  missingFields: string[];
  warnings: ParserWarning[];
  nextRecommendedAction: string;
  flights: FlightRecord[];
};

export type WeatherProviderStatus = {
  mode: WeatherMode;
  available: boolean;
  label: string;
  lastChecked?: string;
  message: string;
};

export type WeatherProvider = {
  mode: WeatherMode;
  getHistoricalWeatherForFlight: (flight: FlightRecord) => Promise<WeatherSnapshot[]>;
  getForecastWindows: (location: { latitude: number; longitude: number }) => Promise<WeatherWindow[]>;
  getStatus: () => WeatherProviderStatus;
};

export type UserFlightProfile = {
  flightCount: number;
  averageBatteryDrainPerMinute?: number;
  averageSpeedMps?: number;
  averageHoverRatio?: number;
  averageRiskScore?: number;
  typicalDistanceMeters?: number;
};

export type UploadedDataState = {
  flights: FlightRecord[];
  lastParserResult?: ParserResult;
  weatherMode: WeatherMode;
  lastWeatherProviderStatus?: WeatherProviderStatus;
  updatedAt?: string;
};
