import type { FlightRecord, ParserResult, ParserWarning, TelemetryPoint } from "@/types";
import { deriveFlightMetrics, toNumber } from "@/lib/analytics/metrics";
import { generateFlightEvents, generateFlightTags } from "@/lib/data/events";
import { getFeatureAvailability, missingRecommendedFields } from "@/lib/schema/featureAvailability";

type FileType = "csv" | "json" | "txt" | "zip" | "unknown";

const fieldAliases: Record<keyof TelemetryPoint, string[]> = {
  timestamp: ["timestamp", "time", "datetime", "dateTime", "date"],
  latitude: ["latitude", "lat", "gpsLatitude"],
  longitude: ["longitude", "lon", "lng", "gpsLongitude"],
  altitudeMeters: ["altitudeMeters", "altitude", "height", "heightMeters", "altitude_m"],
  speedMps: ["speedMps", "speed", "speed_mps", "horizontalSpeed"],
  batteryPercent: ["batteryPercent", "battery", "battery_percent", "batteryLevel"],
  distanceFromHomeMeters: ["distanceFromHomeMeters", "distanceFromHome", "homeDistance"],
  headingDegrees: ["headingDegrees", "heading", "yaw"],
  verticalSpeedMps: ["verticalSpeedMps", "verticalSpeed", "vz"],
  gpsSatellites: ["gpsSatellites", "satellites", "satelliteCount"],
  signalStrengthPercent: ["signalStrengthPercent", "signalStrength", "signal"],
  eventType: ["eventType", "event", "message"],
  weather: ["weather"],
};

export function detectFileType(file: File): FileType {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".txt")) return "txt";
  if (name.endsWith(".zip")) return "zip";
  return "unknown";
}

export async function parseUploadedFlightFile(file: File): Promise<ParserResult> {
  const fileType = detectFileType(file);
  if (fileType === "unknown") return emptyResult("unsupported file", "Upload a .csv, .json, .txt, or .zip file.");

  try {
    if (fileType === "zip") return parseDjiFlightRecordsZip(file);
    const text = await file.text();
    if (fileType === "json") return parseFlightJson(text, file.name);
    if (fileType === "csv" || fileType === "txt") return parseFlightCsv(text, file.name);
    return emptyResult("unsupported file", "Upload a supported telemetry file.");
  } catch (error) {
    return emptyResult(
      "parse failed",
      "This file uploaded successfully, but AeroStats AI could not recognize the telemetry structure yet. Check the file format or add parser support.",
      [{ code: "parse-exception", message: error instanceof Error ? error.message : "Unknown parse error.", severity: "error" }],
    );
  }
}

export function parseFlightCsv(text: string, sourceFileName: string): ParserResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return emptyResult("invalid telemetry structure", "CSV needs a header row and at least one telemetry row.");
  }
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
  return buildParserResult(rows, sourceFileName);
}

export function parseFlightJson(text: string, sourceFileName: string): ParserResult {
  const parsed = JSON.parse(text);
  const candidateRows =
    Array.isArray(parsed) ? parsed : Array.isArray(parsed.telemetry) ? parsed.telemetry : Array.isArray(parsed.points) ? parsed.points : undefined;

  if (Array.isArray(parsed?.flights)) {
    const flights = parsed.flights.flatMap((flight: { telemetry?: unknown[]; points?: unknown[]; name?: string }, index: number) => {
      const telemetryRows = Array.isArray(flight.telemetry) ? flight.telemetry : Array.isArray(flight.points) ? flight.points : [];
      return createFlightsFromRows(telemetryRows, sourceFileName, flight.name ?? `Imported flight ${index + 1}`);
    });
    return parserResultFromFlights(flights, []);
  }

  if (!candidateRows) {
    return emptyResult("invalid telemetry structure", "JSON should be an array of telemetry points or an object with telemetry, points, or flights.");
  }
  return buildParserResult(candidateRows, sourceFileName);
}

export function parseDjiFlightRecord(): ParserResult {
  return emptyResult(
    "partially parsed",
    "DJI Fly FlightRecord parsing is scaffolded. Add DJI field extraction before importing this format as normalized telemetry.",
    [{ code: "dji-parser-planned", message: "DJI FlightRecords are detected but not interpreted yet.", severity: "info" }],
  );
}

export function parseDjiFlightRecordsZip(file?: File): ParserResult {
  void file;
  return emptyResult(
    "partially parsed",
    "DJI Fly FlightRecords .zip support is scaffolded. Upload internal AeroStats AI CSV/JSON telemetry for the MVP.",
    [{ code: "zip-parser-planned", message: "Zip extraction and DJI field mapping are planned in the parser layer.", severity: "info" }],
  );
}

export function normalizeTelemetry(row: unknown): TelemetryPoint | undefined {
  if (!row || typeof row !== "object") return undefined;
  const record = row as Record<string, unknown>;
  const point: Partial<TelemetryPoint> = {};
  for (const [canonical, aliases] of Object.entries(fieldAliases) as Array<[keyof TelemetryPoint, string[]]>) {
    const foundKey = aliases.find((alias) => record[alias] !== undefined);
    if (!foundKey) continue;
    const value = record[foundKey];
    if (canonical === "timestamp") point.timestamp = normalizeTimestamp(value);
    else if (canonical === "eventType") point.eventType = String(value);
    else if (canonical !== "weather") {
      const numeric = toNumber(value);
      if (numeric !== undefined) (point[canonical] as number | undefined) = numeric;
    }
  }
  if (!point.timestamp || point.latitude === undefined || point.longitude === undefined) return undefined;
  return point as TelemetryPoint;
}

export function validateFlightRecord(telemetry: TelemetryPoint[]) {
  const missingRequired = [];
  if (!telemetry.some((point) => point.timestamp)) missingRequired.push("timestamp");
  if (!telemetry.some((point) => point.latitude !== undefined)) missingRequired.push("latitude");
  if (!telemetry.some((point) => point.longitude !== undefined)) missingRequired.push("longitude");
  return {
    valid: missingRequired.length === 0 && telemetry.length > 0,
    missingRequired,
    missingRecommended: missingRecommendedFields(telemetry),
  };
}

export function extractFlightMetadata(telemetry: TelemetryPoint[], sourceFileName: string, confidence: number) {
  return {
    startTime: telemetry[0]?.timestamp,
    endTime: telemetry[telemetry.length - 1]?.timestamp,
    locationLabel: telemetry[0] ? `${telemetry[0].latitude.toFixed(4)}, ${telemetry[0].longitude.toFixed(4)}` : undefined,
    parserConfidence: confidence,
    pointCount: telemetry.length,
    sourceFileName,
  };
}

export function splitIntoFlights(telemetry: TelemetryPoint[]) {
  const sorted = [...telemetry].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const groups: TelemetryPoint[][] = [];
  let current: TelemetryPoint[] = [];
  sorted.forEach((point, index) => {
    const previous = sorted[index - 1];
    const gapMinutes = previous ? (Date.parse(point.timestamp) - Date.parse(previous.timestamp)) / 60000 : 0;
    if (previous && gapMinutes > 30 && current.length) {
      groups.push(current);
      current = [];
    }
    current.push(point);
  });
  if (current.length) groups.push(current);
  return groups;
}

export { deriveFlightMetrics, generateFlightEvents, generateFlightTags };

function buildParserResult(rows: unknown[], sourceFileName: string): ParserResult {
  const flights = createFlightsFromRows(rows, sourceFileName);
  const warnings: ParserWarning[] = [];
  if (!flights.length) {
    return emptyResult(
      "invalid telemetry structure",
      "This file uploaded successfully, but AeroStats AI could not recognize the telemetry structure yet. Check the file format or add parser support.",
    );
  }
  if (flights.some((flight) => flight.metadata.parserConfidence < 75)) {
    warnings.push({ code: "partial-fields", message: "Some recommended telemetry fields are missing, so selected analytics are disabled.", severity: "warning" });
  }
  return parserResultFromFlights(flights, warnings);
}

function createFlightsFromRows(rows: unknown[], sourceFileName: string, baseName?: string): FlightRecord[] {
  const normalized = rows.map(normalizeTelemetry).filter((point): point is TelemetryPoint => Boolean(point));
  return splitIntoFlights(normalized).map((telemetry, index) => {
    const validation = validateFlightRecord(telemetry);
    const confidence = Math.round(100 - validation.missingRecommended.length * 7 - validation.missingRequired.length * 22);
    const metrics = deriveFlightMetrics(telemetry);
    const featureAvailability = getFeatureAvailability(telemetry);
    const flight: FlightRecord = {
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      name: baseName ?? `${stripExtension(sourceFileName)} flight ${index + 1}`,
      sourceFileName,
      importedAt: new Date().toISOString(),
      metadata: extractFlightMetadata(telemetry, sourceFileName, Math.max(20, confidence)),
      telemetry,
      metrics,
      events: generateFlightEvents(telemetry),
      tags: [],
      featureAvailability,
    };
    flight.tags = generateFlightTags(flight);
    return flight;
  });
}

function parserResultFromFlights(flights: FlightRecord[], warnings: ParserWarning[]): ParserResult {
  const telemetryPoints = flights.reduce((sum, flight) => sum + flight.telemetry.length, 0);
  const allTelemetry = flights.flatMap((flight) => flight.telemetry);
  const start = allTelemetry[0]?.timestamp;
  const end = allTelemetry[allTelemetry.length - 1]?.timestamp;
  const missingFields = Array.from(new Set(flights.flatMap((flight) => missingRecommendedFields(flight.telemetry))));
  return {
    status: warnings.length ? "partially parsed" : "success",
    detectedFlights: flights.length,
    telemetryPoints,
    dateRange: start && end ? { start, end } : undefined,
    hasGps: allTelemetry.some((point) => point.latitude !== undefined && point.longitude !== undefined),
    hasBattery: allTelemetry.some((point) => point.batteryPercent !== undefined),
    hasAltitude: allTelemetry.some((point) => point.altitudeMeters !== undefined),
    hasSpeed: allTelemetry.some((point) => point.speedMps !== undefined),
    hasSignal: allTelemetry.some((point) => point.gpsSatellites !== undefined || point.signalStrengthPercent !== undefined),
    parserConfidence: flights.length ? Math.round(flights.reduce((sum, flight) => sum + flight.metadata.parserConfidence, 0) / flights.length) : 0,
    missingFields,
    warnings,
    nextRecommendedAction: flights.length
      ? "Open the flight library or replay page to inspect parsed telemetry."
      : "Upload an internal AeroStats AI CSV/JSON file with timestamp, latitude, and longitude.",
    flights,
  };
}

function emptyResult(status: ParserResult["status"], nextRecommendedAction: string, warnings: ParserWarning[] = []): ParserResult {
  return {
    status,
    detectedFlights: 0,
    telemetryPoints: 0,
    hasGps: false,
    hasBattery: false,
    hasAltitude: false,
    hasSpeed: false,
    hasSignal: false,
    parserConfidence: 0,
    missingFields: ["timestamp", "latitude", "longitude"],
    warnings,
    nextRecommendedAction,
    flights: [],
  };
}

function normalizeTimestamp(value: unknown) {
  const raw = String(value ?? "");
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return raw;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}
