"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/empty-states/EmptyState";
import { FlightMap } from "@/components/maps/FlightMap";
import { FlightReplayControls } from "@/components/flights/FlightReplayControls";
import { TelemetryPanel } from "@/components/flights/TelemetryPanel";
import { EventTimeline } from "@/components/flights/EventTimeline";
import { TelemetryCharts } from "@/components/charts/TelemetryCharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { useUploadedData } from "@/lib/storage/DataProvider";
import { formatDistance, formatDuration } from "@/lib/analytics/metrics";
import { buildFeaturesFromFlight, classifyFlightRisk, detectFlightAnomalies, predictBatteryUsage } from "@/lib/ml/baseline";
import { deriveFlightMetrics, generateFlightEvents, generateFlightTags } from "@/lib/parsers/flightParsers";
import { getHistoricalWeatherForFlight, getWeatherProviderStatus, joinWeatherToTelemetry, summarizeWeatherImpact } from "@/lib/weather/providers";

export default function FlightDetailPage() {
  const params = useParams<{ id: string }>();
  const { flights, weatherMode, updateFlights } = useUploadedData();
  const flight = flights.find((item) => item.id === params.id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [weatherMessage, setWeatherMessage] = useState("");

  useEffect(() => {
    if (!playing || !flight) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((index) => {
        if (index >= flight.telemetry.length - 1) {
          setPlaying(false);
          return index;
        }
        return Math.min(flight.telemetry.length - 1, index + 1);
      });
    }, 700 / speed);
    return () => window.clearInterval(interval);
  }, [flight, playing, speed]);

  const currentEvent = useMemo(() => flight?.events.find((event) => event.telemetryIndex === currentIndex), [flight, currentIndex]);

  if (!flights.length) {
    return <EmptyState title="Flight replay requires an imported flight." body="Upload telemetry before opening the cinematic replay page." />;
  }
  if (!flight) {
    return <EmptyState title="Flight not found" body="The selected flight is not available in the active dataset. Return to the flight library." action="View flights" href="/flights" />;
  }

  const features = buildFeaturesFromFlight(flight);
  const battery = predictBatteryUsage(features);
  const risk = classifyFlightRisk(features);
  const anomalies = detectFlightAnomalies(flight.telemetry);
  const insights = [
    flight.featureAvailability.speedChart && flight.featureAvailability.batteryAnalytics ? "Battery drain increased during higher-speed segments when speed variation was present." : undefined,
    flight.metrics.hoverRatio !== undefined && flight.metrics.hoverRatio > 0.25 ? "Hover-heavy section detected from low-speed telemetry points." : undefined,
    flight.metrics.routeEfficiency !== undefined && flight.metrics.routeEfficiency < 45 ? "Route efficiency was lower because the flight path included repeated or indirect movement." : undefined,
    flight.weatherJoined ? summarizeWeatherImpact(flight, flight.telemetry.map((point) => point.weather).filter(Boolean) as never) : "Wind impact can be calculated after weather is joined.",
    battery.estimatedSafeFlightMinutes ? `Estimated safe flight time under similar conditions: ${battery.estimatedSafeFlightMinutes} minutes baseline estimate available.` : undefined,
  ].filter(Boolean) as string[];

  async function joinWeather() {
    if (!flight || weatherMode === "disabled") {
      setWeatherMessage("Enable mock or Open-Meteo weather mode in settings before joining weather.");
      return;
    }
    try {
      const weather = await getHistoricalWeatherForFlight(flight, weatherMode);
      const telemetry = joinWeatherToTelemetry(flight.telemetry, weather);
      const metrics = deriveFlightMetrics(telemetry);
      const updated = { ...flight, telemetry, metrics, events: generateFlightEvents(telemetry), tags: generateFlightTags({ metrics, featureAvailability: flight.featureAvailability }), weatherJoined: weather.length > 0 };
      updateFlights(flights.map((item) => (item.id === flight.id ? updated : item)), getWeatherProviderStatus(weatherMode));
      setWeatherMessage(weather.length ? "Weather joined to telemetry by nearest timestamp." : "Weather provider returned no usable weather rows.");
    } catch (error) {
      setWeatherMessage(error instanceof Error ? error.message : "Weather fetch failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link href="/flights" className="text-sm text-[#0066cc]">Back to flights</Link>
          <h1 className="mt-2 text-3xl font-semibold text-[#1d1d1f]">{flight.name}</h1>
          <p className="mt-2 text-sm text-[#6e6e73]">Replay, event markers, telemetry, charts, and baseline insights are generated from this uploaded flight only.</p>
        </div>
        <button onClick={() => void joinWeather()} className="rounded-full border border-[#0071e3] px-5 py-2.5 text-sm font-medium text-[#0066cc] hover:bg-[#0071e3]/10">Join weather</button>
      </div>
      {weatherMessage ? <p className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-3 text-sm text-[#6e6e73]">{weatherMessage}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Duration" value={formatDuration(flight.metrics.durationSeconds)} />
        <StatCard label="Distance" value={formatDistance(flight.metrics.totalDistanceMeters)} />
        <StatCard label="Battery used" value={flight.metrics.batteryUsedPercent !== undefined ? `${flight.metrics.batteryUsedPercent.toFixed(1)}%` : "Unavailable"} />
        <StatCard label="Risk estimate" value={flight.metrics.riskScore !== undefined ? `${flight.metrics.riskScore}/100` : "Unavailable"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <FlightMap telemetry={flight.telemetry} currentIndex={currentIndex} events={flight.events} />
          <FlightReplayControls
            playing={playing}
            currentIndex={currentIndex}
            maxIndex={flight.telemetry.length - 1}
            speed={speed}
            onToggle={() => setPlaying((value) => !value)}
            onSeek={setCurrentIndex}
            onSpeed={setSpeed}
          />
        </div>
        <div className="space-y-4">
          <TelemetryPanel point={flight.telemetry[currentIndex]} event={currentEvent} />
          <EventTimeline events={flight.events} onJump={setCurrentIndex} />
        </div>
      </div>

      <TelemetryCharts flight={flight} />

      <section className="grid gap-4 lg:grid-cols-3">
        <Insight title="Battery estimate" body={`${battery.predictedBatteryUsePercent}% predicted use. ${battery.explanation}`} />
        <Insight title="Risk classifier" body={`${risk.riskClass} risk, ${risk.score}/100. ${risk.explanation}`} />
        <Insight title="Anomaly detector" body={anomalies.length ? `${anomalies.length} telemetry anomalies detected for review.` : "No obvious anomalies detected from available telemetry fields."} />
      </section>

      <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
        <h2 className="font-semibold text-[#1d1d1f]">Flight insights</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <div key={insight} className="rounded-md border border-[#d2d2d7] bg-[#ffffff] p-3 text-sm leading-6 text-[#6e6e73]">{insight}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Insight({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
      <h3 className="font-semibold text-[#1d1d1f]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{body}</p>
    </div>
  );
}
