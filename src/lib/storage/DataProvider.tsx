"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { FlightRecord, ParserResult, UploadedDataState, WeatherMode, WeatherProviderStatus } from "@/types";
import { parseUploadedFlightFile } from "@/lib/parsers/flightParsers";
import { getWeatherProviderStatus } from "@/lib/weather/providers";
import { isBackendConfigured, uploadFlightToBackend } from "@/lib/api/client";

type DataContextValue = UploadedDataState & {
  importing: boolean;
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
      return stored ? { ...initialState, ...JSON.parse(stored) } : initialState;
    } catch {
      return initialState;
    }
  });
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      importing,
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
    [importing, state],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useUploadedData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useUploadedData must be used inside DataProvider");
  return context;
}
