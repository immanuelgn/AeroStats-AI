import Link from "next/link";
import type { ComponentType } from "react";
import { BatteryCharging, BrainCircuit, CloudSun, Route } from "lucide-react";
import { PipelinePreview } from "@/components/dashboard/PipelinePreview";

export default function Home() {
  return (
    <div className="space-y-20">
      <section className="relative -mx-4 overflow-hidden px-4 pb-16 pt-20 text-center sm:-mx-6 sm:px-6 lg:rounded-lg">
        <div className="absolute inset-0 -z-10 bg-[url('/skyline-hero.svg')] bg-cover bg-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/10 via-white/55 to-white" />

        <p className="mb-5 text-sm font-semibold text-[#0066cc]">Personal flight intelligence</p>
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-[-0.035em] text-[#1d1d1f] sm:text-7xl">
          Every flight becomes a better prediction.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#424245] sm:text-xl">
          A polished telemetry workspace for replaying my drone flights, explaining battery behavior, and validating machine-learning models as the dataset grows.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="rounded-full bg-[#0071e3] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(0,113,227,0.25)] hover:bg-[#0077ed]">
            View dashboard
          </Link>
          <Link href="/model" className="rounded-full bg-white/80 px-6 py-3 text-sm font-medium text-[#0066cc] ring-1 ring-[#0071e3]/20 backdrop-blur hover:bg-white">
            Open model lab
          </Link>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-2 rounded-lg border border-black/[0.08] bg-white/70 p-2 text-left shadow-[0_20px_70px_rgba(0,0,0,0.10)] backdrop-blur md:grid-cols-3">
          <HeroStep label="1" title="Import" body="DJI flight records become normalized telemetry." />
          <HeroStep label="2" title="Analyze" body="Battery, route, weather, GPS and signal are compared." />
          <HeroStep label="3" title="Learn" body="Models retrain as more real flights are added." />
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

function HeroStep({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="rounded-md bg-white/75 p-4">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0071e3] text-xs font-semibold text-white">{label}</span>
      <h2 className="mt-4 font-semibold text-[#1d1d1f]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#6e6e73]">{body}</p>
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
