import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowRight, BatteryCharging, CloudSun, Map, Route } from "lucide-react";
import { PipelinePreview } from "@/components/dashboard/PipelinePreview";

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="grid min-h-[70vh] items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <p className="mb-4 inline-flex rounded-md border border-[#98b58a]/30 bg-[#98b58a]/10 px-3 py-1 text-sm text-[#c8d8bd]">Upload-first drone telemetry analytics</p>
          <h1 className="text-5xl font-semibold text-[#f5f3ec] sm:text-7xl">AeroStats AI</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#c9cec4]">Drone flight analytics, battery forecasting, and weather-aware flight intelligence.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/upload" className="rounded-md bg-[#f5f3ec] px-5 py-3 text-sm font-medium text-[#111411] hover:bg-[#dfe8d7]">Upload Flight Log</Link>
            <Link href="/dashboard" className="rounded-md border border-white/15 px-5 py-3 text-sm text-[#f5f3ec] hover:bg-white/[0.06]">View Dashboard</Link>
            <Link href="/model" className="rounded-md border border-[#98b58a]/35 px-5 py-3 text-sm text-[#dfe8d7] hover:bg-[#98b58a]/10">Explore Pipeline</Link>
          </div>
          <p className="mt-6 max-w-2xl text-sm text-[#a9b0a6]">AeroStats AI starts empty. Upload your own test flight data now, then connect real DJI Fly FlightRecords later.</p>
        </div>
        <ProductPreview />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Feature icon={Route} title="Flight Replay" body="Map path, synced telemetry, event timeline, and replay controls after upload." />
        <Feature icon={BatteryCharging} title="Battery & Risk Prediction" body="Deterministic baseline estimates from uploaded route, battery, speed, altitude, and signal fields." />
        <Feature icon={CloudSun} title="Weather-Aware Forecasting" body="Open-Meteo-ready adapter joins weather separately by GPS coordinates and timestamps." />
        <Feature icon={Map} title="DJI-Ready Import Pipeline" body="Internal CSV/JSON works now; DJI Fly FlightRecords zip support is cleanly scaffolded." />
      </section>

      <PipelinePreview />

      <section className="rounded-lg border border-white/10 bg-[#171a18] p-6">
        <h2 className="text-xl font-semibold text-[#f5f3ec]">Stack</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#a9b0a6]">
          {["Next.js", "TypeScript", "Leaflet", "Open-Meteo-ready weather adapter", "ML-ready prediction pipeline", "DJI-style telemetry parsing"].map((item) => (
            <span key={item} className="rounded-md border border-[#303831] px-3 py-2">{item}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductPreview() {
  const items = [
    "Battery prediction appears after upload",
    "Risk scoring appears after telemetry is processed",
    "Weather-aware forecasts require GPS and timestamp data",
  ];
  return (
    <div className="rounded-lg border border-white/10 bg-[#171a18] p-5 shadow-2xl shadow-black/30">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-[#f5f3ec]">Concept preview</span>
        <span className="rounded-md border border-[#303831] px-2 py-1 text-xs text-[#7f887d]">No live data</span>
      </div>
      <div className="relative h-80 overflow-hidden rounded-lg border border-[#303831] bg-[#101310]">
        <div className="absolute inset-0 opacity-45" style={{ backgroundImage: "linear-gradient(#263026 1px, transparent 1px), linear-gradient(90deg, #263026 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
        <svg viewBox="0 0 500 300" className="absolute inset-0 h-full w-full" aria-label="Static product concept preview">
          <path d="M42 220 C125 120 190 250 268 145 S405 88 462 170" fill="none" stroke="#98b58a" strokeWidth="4" />
          <circle cx="42" cy="220" r="7" fill="#98b58a" />
          <circle cx="462" cy="170" r="7" fill="#d5a85f" />
        </svg>
        <div className="absolute bottom-4 left-4 right-4 grid gap-2">
          {items.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-md border border-[#303831] bg-[#171a18]/90 px-3 py-2 text-xs text-[#a9b0a6]">
              <span>{item}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#171a18] p-5">
      <Icon className="h-5 w-5 text-[#c8d8bd]" />
      <h3 className="mt-4 font-semibold text-[#f5f3ec]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#a9b0a6]">{body}</p>
    </div>
  );
}
