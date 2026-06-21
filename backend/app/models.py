from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class TelemetryPoint(BaseModel):
    timestamp: datetime
    latitude: float
    longitude: float
    altitudeMeters: float | None = None
    speedMps: float | None = None
    batteryPercent: float | None = None
    distanceFromHomeMeters: float | None = None
    headingDegrees: float | None = None
    verticalSpeedMps: float | None = None
    gpsSatellites: int | None = None
    signalStrengthPercent: float | None = None
    eventType: str | None = None
    weather: dict[str, Any] | None = None


class FlightMetrics(BaseModel):
    durationSeconds: int | None = None
    totalDistanceMeters: float | None = None
    batteryUsedPercent: float | None = None
    maxAltitudeMeters: float | None = None
    averageSpeedMps: float | None = None
    maxSpeedMps: float | None = None
    hoverRatio: float | None = None
    altitudeGainMeters: float | None = None
    batteryDrainPerMinute: float | None = None
    batteryDrainPer100m: float | None = None
    routeEfficiency: float | None = None
    aggressiveMovementScore: float | None = None
    signalStabilityScore: float | None = None
    returnMarginScore: float | None = None
    windImpactScore: float | None = None
    featureCompletenessScore: float | None = None


class FlightRecord(BaseModel):
    id: str | None = None
    name: str
    sourceFilename: str
    sourceType: str
    rawFilePath: str | None = None
    normalizedFilePath: str | None = None
    locationName: str | None = None
    startedAt: datetime | None = None
    endedAt: datetime | None = None
    parserConfidence: float = 0
    status: str = "parsed"
    telemetry: list[TelemetryPoint] = Field(default_factory=list)
    downsampledTelemetry: list[TelemetryPoint] = Field(default_factory=list)
    metrics: FlightMetrics = Field(default_factory=FlightMetrics)
    events: list[dict[str, Any]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    featureAvailability: dict[str, bool] = Field(default_factory=dict)


class ParserDiagnostic(BaseModel):
    sourceFilename: str | None = None
    parserName: str
    status: str
    confidence: float
    missingFields: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ParserResult(BaseModel):
    status: str
    detectedFlights: int
    telemetryPoints: int
    parserConfidence: float
    missingFields: list[str]
    warnings: list[str]
    nextRecommendedAction: str
    flights: list[FlightRecord]
    diagnostics: list[ParserDiagnostic]


class ModelStatus(BaseModel):
    backend: str
    supabaseConfigured: bool
    modelArtifactStorage: str
    latestModelRuns: list[dict[str, Any]] = Field(default_factory=list)
    honestyNote: str


class TrainRequest(BaseModel):
    model: Literal["all", "battery", "risk", "anomaly"] = "all"
    maxRows: int = 5000


class PredictionRequest(BaseModel):
    features: dict[str, Any]
    flightId: str | None = None


class ApiEnvelope(BaseModel):
    ok: bool
    data: Any = None
    error: str | None = None
