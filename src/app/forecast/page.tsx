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
          <h1 className="text-3xl font-semibold text-[#f5f3ec]">Best-time-to-fly forecast</h1>
          <p className="mt-2 text-sm text-[#a9b0a6]">Default location comes from the latest uploaded flight: {flight.metadata.locationLabel}.</p>
        </div>
        <button onClick={() => void fetchForecast()} className="rounded-md bg-[#f5f3ec] px-4 py-2 text-sm font-medium text-[#111411] hover:bg-[#dfe8d7]">Rank forecast windows</button>
      </div>
      {weatherMode === "disabled" ? <p className="rounded-lg border border-[#303831] bg-[#151915] p-4 text-sm text-[#d5a85f]">Enable weather mode to rank future flight windows.</p> : null}
      {message ? <p className="rounded-lg border border-[#303831] bg-[#151915] p-4 text-sm text-[#a9b0a6]">{message}</p> : null}
      {windows.length ? (
        <>
          <ChartCard title="Flyability score over time">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={windows.map((window) => ({ time: new Date(window.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), score: window.flyabilityScore }))}>
                <CartesianGrid stroke="#303831" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#7f887d" />
                <YAxis stroke="#7f887d" />
                <Tooltip contentStyle={{ background: "#111411", border: "1px solid #303831", color: "#f5f3ec" }} />
                <Line dataKey="score" stroke="#98b58a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {windows.map((window) => (
              <div key={window.startTime} className="rounded-lg border border-white/10 bg-[#171a18] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-[#f5f3ec]">{new Date(window.startTime).toLocaleString()}</h2>
                  <span className="rounded-md border border-[#98b58a]/40 px-2 py-1 text-xs text-[#c8d8bd]">{window.recommendation?.label}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#a9b0a6]">
                  <span>Wind {window.windSpeedKph ?? "?"} kph</span>
                  <span>Gusts {window.windGustKph ?? "?"} kph</span>
                  <span>Temp {window.temperatureCelsius ?? "?"} C</span>
                  <span>Precip {window.precipitationProbability ?? "?"}%</span>
                  <span>Visibility {window.visibilityMeters ?? "?"} m</span>
                  <span>Score {window.flyabilityScore}/100</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#a9b0a6]">{window.recommendation?.reason}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#a9b0a6]">Recommended window based on estimated weather conditions and past flight patterns.</p>
        </>
      ) : null}
      <div className="rounded-lg border border-[#d5a85f]/30 bg-[#d5a85f]/10 p-4 text-sm leading-6 text-[#e2c383]">
        AeroStats AI provides estimates based on uploaded telemetry and weather data. Always follow local drone regulations, check official airspace tools, maintain visual line of sight, and use your own judgment before flying.
      </div>
    </div>
  );
}
