"use client";

import { useEffect, useState } from "react";
import { useUploadedData } from "@/lib/storage/DataProvider";
import { ParserStatusCard } from "@/components/upload/ParserStatusCard";
import { getBackendHealth, getModelStatus, isBackendConfigured, type BackendHealth, type BackendModelStatus } from "@/lib/api/client";

export default function SettingsPage() {
  const { flights, weatherMode, setWeatherMode, clearData, lastParserResult, lastWeatherProviderStatus } = useUploadedData();
  const [showSchema, setShowSchema] = useState(false);
  const [confirmBrowserReset, setConfirmBrowserReset] = useState(false);
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
        <h1 className="text-3xl font-semibold text-[#1d1d1f]">Settings and diagnostics</h1>
        <p className="mt-2 text-sm text-[#6e6e73]">Data connection, parser diagnostics, weather mode, units, and portfolio export controls.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
          <h2 className="font-semibold text-[#1d1d1f]">Data source status</h2>
          <div className="mt-4 space-y-3 text-sm text-[#6e6e73]">
            <Row label="Status" value={flights.length ? "Uploaded data active" : "Empty"} />
            <Row label="Stored flights" value={String(flights.length)} />
            <Row label="Storage location" value={backend?.supabaseConfigured ? "Supabase Storage/Postgres via backend" : "localStorage fallback"} />
            <Row label="Units" value="Metric" />
            <Row label="Backend status" value={backend ? (backend.ok ? "Online" : "Unavailable") : isBackendConfigured() ? "Backend waking up..." : "Not configured"} />
            <Row label="Supabase status" value={backend?.supabaseConfigured ? "Configured" : "Missing backend env or local fallback"} />
            <Row label="Model artifacts" value={model?.modelArtifactStorage ?? "Supabase Storage bucket after backend setup"} />
          </div>
          <div className="mt-5 rounded-lg bg-[#f5f5f7] p-4">
            <h3 className="text-sm font-medium text-[#1d1d1f]">Browser display cache</h3>
            <p className="mt-1 text-xs leading-5 text-[#6e6e73]">
              Resetting this browser removes its locally displayed flights and preferences only. It does not delete Supabase flight records, model runs, trained artifacts, or ML progress.
            </p>
            {confirmBrowserReset ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    clearData();
                    setConfirmBrowserReset(false);
                  }}
                  className="rounded-full bg-[#1d1d1f] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
                >
                  Confirm browser reset
                </button>
                <button onClick={() => setConfirmBrowserReset(false)} className="rounded-full border border-[#d2d2d7] px-5 py-2.5 text-sm text-[#1d1d1f] hover:bg-white">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmBrowserReset(true)} className="mt-4 rounded-full border border-[#1d1d1f]/30 px-5 py-2.5 text-sm font-medium text-[#1d1d1f] hover:bg-white">
                Reset this browser&apos;s view
              </button>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
          <h2 className="font-semibold text-[#1d1d1f]">Weather mode</h2>
          <label htmlFor="weather-mode" className="mt-4 block text-xs font-medium uppercase tracking-wide text-[#86868b]">Provider</label>
          <select id="weather-mode" value={weatherMode} onChange={(event) => setWeatherMode(event.target.value as never)} className="mt-2 w-full rounded-md border border-[#d2d2d7] bg-[#ffffff] px-3 py-2 text-sm text-[#1d1d1f]">
            <option value="disabled">Disabled</option>
            <option value="mock">Mock, development/testing only</option>
            <option value="open-meteo">Open-Meteo</option>
          </select>
          <p className="mt-3 text-sm leading-6 text-[#6e6e73]">{lastWeatherProviderStatus?.message ?? "Weather is disabled by default and is not called automatically before valid GPS/timestamp data exists."}</p>
        </section>
      </div>

      <ParserStatusCard result={lastParserResult} />

      <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-[#1d1d1f]">Technical schema details</h2>
            <p className="mt-1 text-sm text-[#6e6e73]">Internal CSV/JSON schema and normalized export controls.</p>
          </div>
          <button onClick={() => setShowSchema((value) => !value)} className="rounded-full border border-[#d2d2d7] px-5 py-2.5 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]">{showSchema ? "Hide" : "Show"} schema</button>
        </div>
        {showSchema ? (
          <pre className="mt-4 overflow-auto rounded-md border border-[#d2d2d7] bg-[#f5f5f7] p-4 text-xs leading-6 text-[#424245]">{schemaText}</pre>
        ) : null}
        {flights.length ? (
          <a download="aerostats-normalized-data.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`} className="mt-4 inline-flex rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0077ed]">
            Export normalized data as JSON
          </a>
        ) : null}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#d2d2d7] pb-2">
      <span className="text-[#86868b]">{label}</span>
      <span className="text-right text-[#1d1d1f]">{value}</span>
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
