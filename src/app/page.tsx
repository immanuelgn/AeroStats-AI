import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowRight, BatteryCharging, BrainCircuit, CloudSun, Route } from "lucide-react";
import { PipelinePreview } from "@/components/dashboard/PipelinePreview";

export default function Home() {
  return (
    <div className="space-y-24">
      <section className="flex min-h-[68vh] flex-col items-center justify-center py-14 text-center">
        <p className="mb-5 text-sm font-semibold text-[#0066cc]">Personal flight intelligence</p>
        <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.035em] text-[#1d1d1f] sm:text-7xl">
          Every flight becomes a better prediction.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6e6e73] sm:text-xl">
          AeroStats AI turns my drone telemetry into replayable flight history, performance analysis, and machine-learning models that improve as my dataset grows.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="rounded-full bg-[#0071e3] px-6 py-3 text-sm font-medium text-white hover:bg-[#0077ed]">
            View flight dashboard
          </Link>
          <Link href="/model" className="rounded-full border border-[#0071e3] px-6 py-3 text-sm font-medium text-[#0066cc] hover:bg-[#0071e3]/[0.06]">
            See the ML pipeline
          </Link>
          <Link href="/upload" className="inline-flex items-center gap-1 px-3 py-3 text-sm font-medium text-[#0066cc] hover:underline">
            Add a flight <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-14 w-full max-w-4xl">
          <ProductPreview />
        </div>
      </section>

      <section className="text-center">
        <p className="text-sm font-semibold text-[#0066cc]">Built around my own data</p>
        <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.025em] text-[#1d1d1f] sm:text-5xl">
          From raw telemetry to evidence that the model works.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#6e6e73]">
          The project records each flight, derives comparable features, validates predictions against held-out flights, and reports confidence honestly.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Feature icon={Route} title="Replay every flight" body="Map path, synchronized telemetry, event markers, and controls for reviewing exactly what happened." />
        <Feature icon={BatteryCharging} title="Measure efficiency" body="Compare battery drain, speed, altitude, route efficiency, signal quality, and return margin." />
        <Feature icon={BrainCircuit} title="Validate the ML" body="Train battery, risk, and anomaly models with transparent validation metrics and confidence limits." />
        <Feature icon={CloudSun} title="Add flight context" body="Join weather by GPS and time so changing conditions become part of the analysis." />
      </section>

      <PipelinePreview />

      <section className="border-t border-black/[0.08] py-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">Engineering stack</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm text-[#6e6e73]">
          {["Next.js", "TypeScript", "FastAPI", "Supabase", "scikit-learn", "Leaflet", "Open-Meteo", "Render", "Vercel"].map((item) => (
            <span key={item} className="rounded-full bg-[#f5f5f7] px-4 py-2">{item}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductPreview() {
  const items = [
    "Replay and compare my complete flight history",
    "Track prediction accuracy as new flights are added",
    "Explain battery, risk, anomaly, and weather factors",
  ];

  return (
    <div className="rounded-lg border border-black/[0.08] bg-white p-4 shadow-[0_20px_70px_rgba(0,0,0,0.12)] sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-[#1d1d1f]">Flight intelligence workspace</span>
        <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs text-[#6e6e73]">Live pipeline</span>
      </div>
      <div className="relative h-80 overflow-hidden rounded-lg bg-[#f5f5f7]">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: "linear-gradient(#e5e5ea 1px, transparent 1px), linear-gradient(90deg, #e5e5ea 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
        <svg viewBox="0 0 500 300" className="absolute inset-0 h-full w-full" aria-label="Static flight path concept preview">
          <path d="M42 220 C125 120 190 250 268 145 S405 88 462 170" fill="none" stroke="#0071e3" strokeWidth="4" />
          <circle cx="42" cy="220" r="7" fill="#0071e3" />
          <circle cx="462" cy="170" r="7" fill="#1d1d1f" />
        </svg>
        <div className="absolute bottom-4 left-4 right-4 grid gap-2">
          {items.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-md border border-black/[0.08] bg-white/90 px-3 py-2 text-xs text-[#424245] shadow-sm backdrop-blur">
              <span>{item}</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#0071e3]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-lg bg-[#f5f5f7] p-6">
      <Icon className="h-6 w-6 text-[#0071e3]" />
      <h3 className="mt-5 font-semibold text-[#1d1d1f]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{body}</p>
    </div>
  );
}
