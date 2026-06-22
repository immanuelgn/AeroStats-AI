"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FlightRecord, ParserResult, UploadedDataState, WeatherMode, WeatherProviderStatus } from "@/types";
import { parseUploadedFlightFile } from "@/lib/parsers/flightParsers";
import { getHistoricalWeatherForFlight, getWeatherProviderStatus, joinWeatherToTelemetry } from "@/lib/weather/providers";
import { fetchBackendFlights, isBackendConfigured, uploadFlightToBackend } from "@/lib/api/client";
import { deriveFlightMetrics } from "@/lib/analytics/metrics";
import { generateFlightEvents, generateFlightTags } from "@/lib/data/events";

type DataContextValue = UploadedDataState & {
  importing: boolean;
  backendSyncing: boolean;
  importFiles: (files: File[]) => Promise<ParserResult[]>;
  clearData: () => void;
  setWeatherMode: (mode: WeatherMode) => void;
  updateFlights: (flights: FlightRecord[], status?: WeatherProviderStatus) => void;
};

const storageKey = "aerostats-ai-uploaded-data";

const initialState: UploadedDataState = {
  flights: [],
  weatherMode: "disabled",
};

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UploadedDataState>(() => {
    if (typeof window === "undefined") return initialState;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return initialState;
      const parsed = { ...initialState, ...JSON.parse(stored) } as UploadedDataState;
      return {
        ...parsed,
        flights: parsed.flights.map((flight) => {
          const metrics = deriveFlightMetrics(flight.telemetry);
          return {
            ...flight,
            metrics,
            events: generateFlightEvents(flight.telemetry),
            tags: generateFlightTags({ metrics, featureAvailability: flight.featureAvailability }),
          };
        }),
      };
    } catch {
      return initialState;
    }
  });
  const [importing, setImporting] = useState(false);
  const [backendSyncing, setBackendSyncing] = useState(() => isBackendConfigured());
  const weatherJoinRunning = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!isBackendConfigured()) return;
    let cancelled = false;
    void fetchBackendFlights()
      .then((backendFlights) => {
        if (cancelled || !backendFlights.length) return;
        setState((current) => ({
          ...current,
          flights: mergeFlights(current.flights, backendFlights),
          updatedAt: new Date().toISOString(),
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setBackendSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const pending = state.flights.filter((flight) => !flight.weatherJoined);
    if (state.weatherMode !== "open-meteo" || !pending.length || weatherJoinRunning.current) return;
    weatherJoinRunning.current = true;
    void Promise.all(pending.map(async (flight) => {
      const weather = await getHistoricalWeatherForFlight(flight, state.weatherMode);
      if (!weather.length) return flight;
      const telemetry = joinWeatherToTelemetry(flight.telemetry, weather);
      const metrics = deriveFlightMetrics(telemetry);
      return {
        ...flight,
        telemetry,
        metrics,
        events: generateFlightEvents(telemetry),
        tags: generateFlightTags({ metrics, featureAvailability: flight.featureAvailability }),
        weatherJoined: true,
      };
    })).then((joinedFlights) => {
      const updates = new Map(joinedFlights.map((flight) => [flight.id, flight]));
      setState((current) => ({
        ...current,
        flights: current.flights.map((flight) => updates.get(flight.id) ?? flight),
        lastWeatherProviderStatus: getWeatherProviderStatus("open-meteo"),
        updatedAt: new Date().toISOString(),
      }));
    }).catch(() => {
      setState((current) => ({
        ...current,
        lastWeatherProviderStatus: {
          mode: "open-meteo",
          available: false,
          label: "Weather unavailable",
          message: "Historical weather could not be joined. Flight telemetry remains available.",
          lastChecked: new Date().toISOString(),
        },
      }));
    }).finally(() => {
      weatherJoinRunning.current = false;
    });
  }, [state.flights, state.weatherMode]);

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      importing,
      backendSyncing,
      importFiles: async (files: File[]) => {
        setImporting(true);
        const results: ParserResult[] = [];
        try {
          for (const file of files) {
            try {
              if (isBackendConfigured()) {
                const localResult = file.name.toLowerCase().startsWith("djiflightrecord_") ? await parseUploadedFlightFile(file) : undefined;
                if (localResult && !localResult.flights.length) {
                  results.push(localResult);
                  continue;
                }
                const normalizedTelemetry = localResult?.flights.flatMap((flight) => flight.telemetry);
                const response = await uploadFlightToBackend(file, normalizedTelemetry);
                results.push(response.parser);
              } else {
                const result = await parseUploadedFlightFile(file);
                results.push(result);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : "Upload failed.";
              const duplicate = message.toLowerCase().includes("already been uploaded");
              results.push({
                status: "parse failed",
                detectedFlights: 0,
                telemetryPoints: 0,
                hasGps: false,
                hasBattery: false,
                hasAltitude: false,
                hasSpeed: false,
                hasSignal: false,
                parserConfidence: 0,
                missingFields: [],
                warnings: [{
                  code: duplicate ? "duplicate-upload" : "upload-failed",
                  message,
                  severity: duplicate ? "warning" : "error",
                }],
                nextRecommendedAction: duplicate
                  ? "Choose a different source flight file. This copy was not stored or added to ML training data."
                  : "Check the backend connection and try the upload again.",
                flights: [],
              });
            }
          }
          const importedFlights = results.flatMap((result) => result.flights);
          const lastParserResult = results[results.length - 1];
          setState((current) => ({
            ...current,
            flights: [...current.flights, ...importedFlights],
            lastParserResult,
            updatedAt: new Date().toISOString(),
          }));
          return results;
        } finally {
          setImporting(false);
        }
      },
      clearData: () => setState(initialState),
      setWeatherMode: (mode: WeatherMode) =>
        setState((current) => ({
          ...current,
          weatherMode: mode,
          lastWeatherProviderStatus: getWeatherProviderStatus(mode),
          updatedAt: new Date().toISOString(),
        })),
      updateFlights: (flights: FlightRecord[], status?: WeatherProviderStatus) =>
        setState((current) => ({
          ...current,
          flights,
          lastWeatherProviderStatus: status ?? current.lastWeatherProviderStatus,
          updatedAt: new Date().toISOString(),
        })),
    }),
    [backendSyncing, importing, state],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useUploadedData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useUploadedData must be used inside DataProvider");
  return context;
}

function mergeFlights(localFlights: FlightRecord[], backendFlights: FlightRecord[]) {
  const merged = new Map<string, FlightRecord>();
  for (const flight of backendFlights) merged.set(flight.id, flight);
  for (const flight of localFlights) {
    const backendFlight = merged.get(flight.id);
    merged.set(flight.id, flight.telemetry.length || !backendFlight ? flight : backendFlight);
  }
  return Array.from(merged.values()).sort((a, b) => {
    const bTime = new Date(b.metadata.startTime ?? b.importedAt).getTime();
    const aTime = new Date(a.metadata.startTime ?? a.importedAt).getTime();
    return bTime - aTime;
  });
}
