"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain, MapPin, Thermometer, Wind } from "lucide-react";
import type { WeatherWindow } from "@/types";
import { ChartCard } from "@/components/charts/ChartCard";
import { EmptyState } from "@/components/empty-states/EmptyState";
import { useUploadedData } from "@/lib/storage/DataProvider";
import { latestFlight } from "@/lib/data/summaries";
import { getForecastWindows, getWeatherProviderStatus } from "@/lib/weather/providers";
import { buildUserFlightProfile, rankFlightWindows } from "@/lib/ml/baseline";

const ForecastFlightMap = dynamic(() => import("@/components/maps/FlightMap").then((mod) => mod.FlightMap), {
  ssr: false,
  loading: () => <div className="flex h-[320px] items-center justify-center bg-[#f5f5f7] text-sm text-[#6e6e73]">Loading flight map...</div>,
});

export default function ForecastPage() {
  const { backendSyncing, flights, weatherMode } = useUploadedData();
  const [windows, setWindows] = useState<WeatherWindow[]>([]);
  const [message, setMessage] = useState("");
  const flight = latestFlight(flights);
  const point = flight?.telemetry.find((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && Boolean(item.timestamp));
  const hasForecastLocation = Boolean(point?.timestamp && Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  const weatherStatus = getWeatherProviderStatus(weatherMode);
  const bestWindow = windows[0];
  const chronologicalWindows = [...windows].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

  if (backendSyncing && !flights.length) {
    return (
      <div className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-8 text-center">
        <h1 className="text-xl font-semibold text-[#1d1d1f]">Loading my flight history...</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#6e6e73]">AeroStats AI is syncing saved flights from the backend before building a forecast location.</p>
      </div>
    );
  }

  if (!flight || !point || !hasForecastLocation) {
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
      setMessage(weatherStatus.message);
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

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="overflow-hidden rounded-lg border border-black/[0.08] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.08] p-4">
            <div>
              <h2 className="font-semibold text-[#1d1d1f]">Forecast location</h2>
              <p className="mt-1 text-sm text-[#6e6e73]">Based on the latest uploaded flight path.</p>
            </div>
            <span className="rounded-full bg-[#0071e3]/10 px-3 py-1 text-xs font-medium text-[#0066cc]">{flight.metadata.locationLabel}</span>
          </div>
          <ForecastFlightMap telemetry={flight.telemetry} currentIndex={0} events={flight.events} heightClassName="h-[320px]" />
        </div>

        <div className="rounded-lg border border-black/[0.08] bg-[#f5f5f7] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-[#0066cc]">
            <MapPin className="h-4 w-4" />
            Active forecast anchor
          </div>
          <dl className="mt-5 space-y-4">
            <LocationMetric label="Coordinates" value={`${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`} />
            <LocationMetric label="Source flight" value={flight.name} />
            <LocationMetric label="Weather provider" value={weatherStatus.label} />
            <LocationMetric label="Ranking mode" value="Best upcoming windows by flyability score" />
          </dl>
          {!windows.length ? (
            <p className="mt-5 rounded-md bg-white p-3 text-sm leading-6 text-[#6e6e73]">
              Press Rank forecast windows to pull weather for this location and score each upcoming flight window.
            </p>
          ) : null}
        </div>
      </section>

      {weatherMode === "disabled" ? <p className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-4 text-sm text-[#0071e3]">Enable weather mode to rank future flight windows.</p> : null}
      {message ? <p className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-4 text-sm text-[#6e6e73]">{message}</p> : null}
      {windows.length ? (
        <>
          {bestWindow ? (
            <section className="rounded-lg bg-[#1d1d1f] p-6 text-white">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                  <p className="text-sm font-medium text-white/65">Top ranked window</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">{new Date(bestWindow.startTime).toLocaleString()}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">{bestWindow.recommendation?.reason}</p>
                </div>
                <div className="rounded-full bg-[#0071e3] px-5 py-2 text-sm font-semibold">{bestWindow.flyabilityScore}/100</div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <WeatherMetric icon={Thermometer} label="Temperature" value={`${formatMaybe(bestWindow.temperatureCelsius)} C`} />
                <WeatherMetric icon={Wind} label="Wind aloft" value={`${formatMaybe(bestWindow.windSpeed80mKph ?? bestWindow.windSpeed100mKph ?? bestWindow.windSpeed120mKph ?? bestWindow.windSpeedKph)} kph`} />
                <WeatherMetric icon={CloudRain} label="Precipitation" value={`${formatMaybe(bestWindow.precipitationProbability)}%`} />
                <WeatherMetric icon={MapPin} label="Visibility" value={`${formatMaybe(bestWindow.visibilityMeters)} m`} />
              </div>
            </section>
          ) : null}

          <ChartCard title="Flyability score over time">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chronologicalWindows.map((window) => ({ time: new Date(window.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), score: window.flyabilityScore }))}>
                <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#86868b" />
                <YAxis stroke="#86868b" />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} />
                <Line dataKey="score" stroke="#0071e3" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {windows.map((window, index) => (
              <div key={window.startTime} className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[#86868b]">Rank #{index + 1}</p>
                    <h2 className="mt-1 font-semibold text-[#1d1d1f]">{new Date(window.startTime).toLocaleString()}</h2>
                  </div>
                  <span className="rounded-md border border-[#0071e3]/40 px-2 py-1 text-xs text-[#0066cc]">{window.recommendation?.label}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#6e6e73]">
                  <span>Wind aloft {window.windSpeed80mKph ?? window.windSpeed100mKph ?? window.windSpeed120mKph ?? window.windSpeedKph ?? "?"} kph</span>
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

function LocationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[#86868b]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[#1d1d1f]">{value}</dd>
    </div>
  );
}

function WeatherMetric({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/10 p-4">
      <Icon className="h-5 w-5 text-[#7ab7ff]" />
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-white/55">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatMaybe(value: number | undefined) {
  return value === undefined ? "?" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}
