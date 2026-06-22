"use client";

import { useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeatherWindow } from "@/types";
import { ChartCard } from "@/components/charts/ChartCard";
import { EmptyState } from "@/components/empty-states/EmptyState";
import { useUploadedData } from "@/lib/storage/DataProvider";
import { latestFlight } from "@/lib/data/summaries";
import { getForecastWindows, getWeatherProviderStatus } from "@/lib/weather/providers";
import { buildUserFlightProfile, rankFlightWindows } from "@/lib/ml/baseline";

export default function ForecastPage() {
  const { flights, weatherMode } = useUploadedData();
  const [windows, setWindows] = useState<WeatherWindow[]>([]);
  const [message, setMessage] = useState("");
  const flight = latestFlight(flights);
  const point = flight?.telemetry[0];

  if (!flight?.featureAvailability.forecast || !point) {
    return <EmptyState title="Forecasting requires an uploaded flight with GPS coordinates and timestamps." body="Upload telemetry with timestamp, latitude, and longitude before ranking flight windows." />;
  }

  async function fetchForecast() {
    if (!point || weatherMode === "disabled") {
      setMessage("Enable weather mode to rank future flight windows.");
      return;
    }
    try {
      const raw = await getForecastWindows({ latitude: point.latitude, longitude: point.longitude }, weatherMode);
      setWindows(rankFlightWindows(raw, buildUserFlightProfile(flights)));
      setMessage(getWeatherProviderStatus(weatherMode).message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Forecast fetch failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-[#1d1d1f]">Best-time-to-fly forecast</h1>
          <p className="mt-2 text-sm text-[#6e6e73]">Default location comes from the latest uploaded flight: {flight.metadata.locationLabel}.</p>
        </div>
        <button onClick={() => void fetchForecast()} className="rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0077ed]">Rank forecast windows</button>
      </div>
      {weatherMode === "disabled" ? <p className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-4 text-sm text-[#0071e3]">Enable weather mode to rank future flight windows.</p> : null}
      {message ? <p className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-4 text-sm text-[#6e6e73]">{message}</p> : null}
      {windows.length ? (
        <>
          <ChartCard title="Flyability score over time">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={windows.map((window) => ({ time: new Date(window.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), score: window.flyabilityScore }))}>
                <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#86868b" />
                <YAxis stroke="#86868b" />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} />
                <Line dataKey="score" stroke="#0071e3" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {windows.map((window) => (
              <div key={window.startTime} className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-[#1d1d1f]">{new Date(window.startTime).toLocaleString()}</h2>
                  <span className="rounded-md border border-[#0071e3]/40 px-2 py-1 text-xs text-[#0066cc]">{window.recommendation?.label}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#6e6e73]">
                  <span>Wind {window.windSpeedKph ?? "?"} kph</span>
                  <span>Gusts {window.windGustKph ?? "?"} kph</span>
                  <span>Temp {window.temperatureCelsius ?? "?"} C</span>
                  <span>Precip {window.precipitationProbability ?? "?"}%</span>
                  <span>Visibility {window.visibilityMeters ?? "?"} m</span>
                  <span>Score {window.flyabilityScore}/100</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#6e6e73]">{window.recommendation?.reason}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#6e6e73]">Recommended window based on estimated weather conditions and past flight patterns.</p>
        </>
      ) : null}
      <div className="rounded-lg border border-[#0071e3]/30 bg-[#0071e3]/10 p-4 text-sm leading-6 text-[#0066cc]">
        AeroStats AI provides estimates based on uploaded telemetry and weather data. Always follow local drone regulations, check official airspace tools, maintain visual line of sight, and use your own judgment before flying.
      </div>
    </div>
  );
}
