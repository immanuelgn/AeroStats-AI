"use client";

import { useEffect, useState } from "react";
import { useUploadedData } from "@/lib/storage/DataProvider";
import { ParserStatusCard } from "@/components/upload/ParserStatusCard";
import { getBackendHealth, getModelStatus, isBackendConfigured, type BackendHealth, type BackendModelStatus } from "@/lib/api/client";

export default function SettingsPage() {
  const { flights, weatherMode, setWeatherMode, clearData, lastParserResult, lastWeatherProviderStatus } = useUploadedData();
  const [showSchema, setShowSchema] = useState(false);
  const [backend, setBackend] = useState<BackendHealth | null>(null);
  const [model, setModel] = useState<BackendModelStatus | null>(null);
  const exportJson = JSON.stringify({ exportedAt: new Date().toISOString(), flights }, null, 2);

  useEffect(() => {
    if (!isBackendConfigured()) return;
    getBackendHealth().then(setBackend).catch(() => setBackend({ ok: false }));
    getModelStatus().then(setModel).catch(() => setModel(null));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#f5f3ec]">Settings and diagnostics</h1>
        <p className="mt-2 text-sm text-[#a9b0a6]">Local MVP controls for data, parser diagnostics, weather mode, units, and export.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-[#171a18] p-5">
          <h2 className="font-semibold text-[#f5f3ec]">Data source status</h2>
          <div className="mt-4 space-y-3 text-sm text-[#a9b0a6]">
            <Row label="Status" value={flights.length ? "Uploaded data active" : "Empty"} />
            <Row label="Stored flights" value={String(flights.length)} />
            <Row label="Storage location" value={backend?.supabaseConfigured ? "Supabase Storage/Postgres via backend" : "localStorage fallback"} />
            <Row label="Units" value="Metric" />
            <Row label="Backend status" value={backend ? (backend.ok ? "Online" : "Unavailable") : isBackendConfigured() ? "Backend waking up..." : "Not configured"} />
            <Row label="Supabase status" value={backend?.supabaseConfigured ? "Configured" : "Missing backend env or local fallback"} />
            <Row label="Model artifacts" value={model?.modelArtifactStorage ?? "Supabase Storage bucket after backend setup"} />
          </div>
          <button onClick={clearData} className="mt-5 rounded-md border border-[#e07b67]/40 px-4 py-2 text-sm text-[#f0a190] hover:bg-[#e07b67]/10">Clear uploaded data</button>
        </section>

        <section className="rounded-lg border border-white/10 bg-[#171a18] p-5">
          <h2 className="font-semibold text-[#f5f3ec]">Weather mode</h2>
          <select value={weatherMode} onChange={(event) => setWeatherMode(event.target.value as never)} className="mt-4 w-full rounded-md border border-[#303831] bg-[#111411] px-3 py-2 text-sm text-[#f5f3ec]">
            <option value="disabled">Disabled</option>
            <option value="mock">Mock, development/testing only</option>
            <option value="open-meteo">Open-Meteo</option>
          </select>
          <p className="mt-3 text-sm leading-6 text-[#a9b0a6]">{lastWeatherProviderStatus?.message ?? "Weather is disabled by default and is not called automatically before valid GPS/timestamp data exists."}</p>
        </section>
      </div>

      <ParserStatusCard result={lastParserResult} />

      <section className="rounded-lg border border-white/10 bg-[#171a18] p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-[#f5f3ec]">Technical schema details</h2>
            <p className="mt-1 text-sm text-[#a9b0a6]">Internal CSV/JSON schema and normalized export controls.</p>
          </div>
          <button onClick={() => setShowSchema((value) => !value)} className="rounded-md border border-[#303831] px-4 py-2 text-sm text-[#f5f3ec] hover:bg-white/[0.06]">{showSchema ? "Hide" : "Show"} schema</button>
        </div>
        {showSchema ? (
          <pre className="mt-4 overflow-auto rounded-md border border-[#303831] bg-[#101310] p-4 text-xs leading-6 text-[#c9cec4]">{schemaText}</pre>
        ) : null}
        {flights.length ? (
          <a download="aerostats-normalized-data.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`} className="mt-4 inline-flex rounded-md bg-[#f5f3ec] px-4 py-2 text-sm font-medium text-[#111411] hover:bg-[#dfe8d7]">
            Export normalized data as JSON
          </a>
        ) : null}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#303831] pb-2">
      <span className="text-[#7f887d]">{label}</span>
      <span className="text-right text-[#f5f3ec]">{value}</span>
    </div>
  );
}

const schemaText = `Minimum required fields:
timestamp, latitude, longitude

Recommended fields:
altitudeMeters, speedMps, batteryPercent, distanceFromHomeMeters,
headingDegrees, verticalSpeedMps, gpsSatellites, signalStrengthPercent, eventType

Feature unlocking:
Map path requires latitude + longitude.
Replay requires timestamp + latitude + longitude.
Battery analytics require batteryPercent.
Altitude chart requires altitudeMeters.
Speed chart requires speedMps.
Signal stability requires gpsSatellites or signalStrengthPercent.
Weather join requires timestamp + latitude + longitude.`;
