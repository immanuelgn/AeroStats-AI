"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BrainCircuit, CheckCircle2, ChevronRight, CloudSun, Database, FlaskConical, Gauge, Info, LockKeyhole, Play, TriangleAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/empty-states/EmptyState";
import { PipelinePreview } from "@/components/dashboard/PipelinePreview";
import { useUploadedData } from "@/lib/storage/DataProvider";
import {
  buildFeaturesFromFlight,
  buildUserFlightProfile,
  calculateFeatureImportance,
  classifyFlightRisk,
  detectFlightAnomalies,
  explainPrediction,
  predictBatteryUsage,
} from "@/lib/ml/baseline";
import { latestFlight } from "@/lib/data/summaries";
import { getModelStatus, isBackendConfigured, joinWeatherBackend, trainModels, type BackendModelStatus } from "@/lib/api/client";

export default function ModelPage() {
  const { flights, weatherMode } = useUploadedData();
  const [backendStatus, setBackendStatus] = useState<BackendModelStatus | null>(null);
  const [trainingState, setTrainingState] = useState("");
  const [training, setTraining] = useState(false);
  const flight = latestFlight(flights);

  useEffect(() => {
    if (!isBackendConfigured()) return;
    getModelStatus().then(setBackendStatus).catch((error) => setTrainingState(error instanceof Error ? error.message : "Backend status unavailable."));
  }, []);

  const features = useMemo(() => flight ? buildFeaturesFromFlight(flight) : undefined, [flight]);
  const battery = features ? predictBatteryUsage(features) : undefined;
  const risk = features ? classifyFlightRisk(features) : undefined;
  const anomalies = flight ? detectFlightAnomalies(flight.telemetry) : [];
  const explanation = features && battery ? explainPrediction(features, battery) : undefined;
  const profile = buildUserFlightProfile(flights);
  const importance = calculateFeatureImportance(flights);
  const trainedRuns = backendStatus?.latestModelRuns ?? [];
  const trained = trainedRuns.length > 0;
  const weatherCount = flights.filter((item) => item.weatherJoined).length;
  const segmentEstimate = flights.reduce((sum, item) => sum + Math.max(0, Math.floor((item.metrics.durationSeconds ?? 0) / 15)), 0);
  const coverage = featureCoverage(flights);

  async function train() {
    setTraining(true);
    setTrainingState(weatherMode === "open-meteo" ? "Joining historical weather, then training available models..." : "Training available models from telemetry...");
    try {
      if (weatherMode === "open-meteo") {
        for (const item of flights) {
          await joinWeatherBackend(item.id);
        }
      }
      await trainModels("all");
      const status = await getModelStatus();
      setBackendStatus(status);
      setTrainingState("Training completed. Review each run’s validation status and confidence below.");
    } catch (error) {
      setTrainingState(error instanceof Error ? error.message : "Training failed.");
    } finally {
      setTraining(false);
    }
  }

  if (!flight || !features || !battery || !risk || !explanation) {
    return (
      <div className="space-y-6">
        <header><p className="text-sm font-medium text-[#0066cc]">Technical workspace</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#1d1d1f]">Model lab</h1></header>
        <PipelinePreview />
        <EmptyState title="The ML pipeline is ready for flight data." body="No fabricated accuracy is shown. Training, validation metrics, and confidence will appear after real telemetry is available." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-[#0066cc]">Technical workspace</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#1d1d1f]">Model lab</h1>
        <p className="mt-3 text-base leading-7 text-[#6e6e73]">Training readiness, validation evidence, feature coverage and transparent baseline calculations for technical reviewers.</p>
      </header>

      <section className={`rounded-lg border p-6 sm:p-8 ${trained ? "border-[#0071e3]/25 bg-[#f5f9ff]" : "border-black/[0.08] bg-[#f5f5f7]"}`}>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${trained ? "bg-[#0071e3] text-white" : "bg-white text-[#1d1d1f]"}`}>
              {trained ? <CheckCircle2 className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-medium text-[#6e6e73]">{trained ? "Trained ML runs available" : "Baseline mode · no trained run yet"}</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#1d1d1f]">
                {trained ? `${trainedRuns.length} model run${trainedRuns.length === 1 ? "" : "s"} stored` : "The numbers below are previews, not learned predictions."}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6e6e73]">
                {trained
                  ? "FastAPI and scikit-learn have produced persisted validation records. Confidence is still limited by the small two-flight dataset."
                  : "AeroStats AI is applying documented formulas to demonstrate the intended outputs. Training will create separate scikit-learn model runs and validation metrics."}
              </p>
            </div>
          </div>
          <button disabled={!isBackendConfigured() || training} onClick={() => void train()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#0071e3] px-5 py-3 text-sm font-medium text-white hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:opacity-50">
            {training ? <Activity className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            {training ? "Training…" : trained ? "Retrain available models" : "Train available models"}
          </button>
        </div>
        {trainingState ? <p className="mt-5 rounded-md bg-white px-4 py-3 text-sm text-[#0066cc]">{trainingState}</p> : null}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-[#1d1d1f]">Training readiness</h2>
          <p className="mt-1 text-sm text-[#6e6e73]">What can train now, and what still needs more evidence.</p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-black/[0.08] bg-black/[0.08] md:grid-cols-2 xl:grid-cols-4">
          <ReadinessCard icon={Database} label="Flight groups" value={`${flights.length}`} target="3 minimum for risk" state={flights.length >= 3 ? "ready" : "waiting"} />
          <ReadinessCard icon={Activity} label="15-second segments" value={`≈ ${segmentEstimate}`} target="10 minimum for anomaly detection" state={segmentEstimate >= 10 ? "ready" : "waiting"} />
          <ReadinessCard icon={CloudSun} label="Weather-enriched" value={`${weatherCount}/${flights.length}`} target={weatherMode === "open-meteo" ? "Joined automatically before training" : "Enable Open-Meteo for weather features"} state={weatherCount > 0 || weatherMode === "open-meteo" ? "ready" : "waiting"} />
          <ReadinessCard icon={BrainCircuit} label="Trained runs" value={`${trainedRuns.length}`} target="Battery + anomaly can start now" state={trained ? "ready" : "waiting"} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-lg border border-black/[0.08] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Available model families</h2>
          <div className="mt-5 divide-y divide-black/[0.08]">
            <ModelReadiness name="Battery drain regression" detail="Learns battery use from whole-flight and segment telemetry." ready={flights.length >= 2 && segmentEstimate >= 3} />
            <ModelReadiness name="Anomaly detection" detail="Isolation Forest searches for unusual telemetry segments." ready={segmentEstimate >= 10} />
            <ModelReadiness name="Flight risk classification" detail="Requires at least three independent flights for grouped validation." ready={flights.length >= 3} />
            <ModelReadiness name="Weather window ranking" detail="Combines forecast weather with your learned flight profile." ready={weatherMode === "open-meteo"} />
          </div>
        </div>

        <div className="rounded-lg border border-black/[0.08] bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-lg font-semibold text-[#1d1d1f]">Feature coverage</h2><p className="mt-1 text-sm text-[#6e6e73]">How consistently the current logs provide each input family.</p></div>
            <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs text-[#6e6e73]">{flights.length} flights</span>
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverage} layout="vertical" margin={{ left: 24, right: 12 }}>
                <CartesianGrid stroke="#e8e8ed" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} stroke="#6e6e73" fontSize={12} />
                <Tooltip formatter={(value) => [`${value}%`, "Coverage"]} contentStyle={{ border: "1px solid #d2d2d7", borderRadius: 8 }} />
                <Bar dataKey="value" fill="#0071e3" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><h2 className="text-2xl font-semibold text-[#1d1d1f]">Baseline preview</h2><p className="mt-1 text-sm text-[#6e6e73]">Readable examples generated by fixed formulas from the latest flight.</p></div>
          <span className="hidden items-center gap-2 text-xs text-[#86868b] sm:inline-flex"><Info className="h-3.5 w-3.5" /> Not trained ML</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PreviewCard icon={Gauge} title="Battery use preview" output={`${battery.predictedBatteryUsePercent}%`} label={`Baseline estimate · actual flight used ${flight.metrics.batteryUsedPercent?.toFixed(0) ?? "—"}%`} body="Calculated from duration, distance, altitude gain, movement, hover behavior and available weather." />
          <PreviewCard icon={TriangleAlert} title="Risk preview" output={`${risk.score}/100`} label={`${risk.riskClass} estimated risk`} body="A transparent rule score using battery drain, movement, return margin, signal/GPS and weather when available." />
          <PreviewCard icon={Activity} title="Anomaly preview" output={`${anomalies.length}`} label="rule-detected events" body={anomalies.length ? anomalies.map((anomaly) => anomaly.label).join(", ") : "No obvious threshold events were found. Trained Isolation Forest results are reported separately."} />
          <PreviewCard icon={CloudSun} title="Flight window readiness" output={weatherMode === "open-meteo" ? "Ready" : "Off"} label="weather provider" body="Forecast ranking can run with Open-Meteo now; learned battery/risk adjustments improve as trained flight history grows." />
        </div>
      </section>

      {trainedRuns.length ? <ModelRuns runs={trainedRuns} /> : null}

      <section className="rounded-lg border border-black/[0.08] bg-white p-6">
        <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-[#0071e3]" /><div><h2 className="font-semibold text-[#1d1d1f]">Validation guardrails</h2><p className="mt-1 text-sm leading-6 text-[#6e6e73]">Grouped validation keeps segments from the same flight out of both training and test sets. High confidence is blocked until flight count, feature completeness, validation error and uncertainty support it.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Guardrail title="No same-flight leakage" body="Validation groups rows by flight ID." />
          <Guardrail title="Honest weak labels" body="Risk remains weakly supervised until human labels exist." />
          <Guardrail title="Out-of-range warnings" body="Predictions outside training conditions are downgraded." />
        </div>
      </section>

      {importance.length ? (
        <details className="group rounded-lg border border-black/[0.08] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6">
            <div><h2 className="font-semibold text-[#1d1d1f]">Baseline weighting and raw feature vector</h2><p className="mt-1 text-sm text-[#6e6e73]">Technical debugging data, collapsed by default.</p></div>
            <ChevronRight className="h-5 w-5 text-[#86868b] transition-transform group-open:rotate-90" />
          </summary>
          <div className="border-t border-black/[0.08] p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={importance}>
                  <CartesianGrid stroke="#e8e8ed" strokeDasharray="3 3" />
                  <XAxis dataKey="feature" stroke="#86868b" interval={0} angle={-15} height={75} textAnchor="end" fontSize={11} />
                  <YAxis stroke="#86868b" />
                  <Tooltip contentStyle={{ border: "1px solid #d2d2d7", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#0071e3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <pre className="mt-6 max-h-80 overflow-auto rounded-md bg-[#f5f5f7] p-4 text-xs leading-6 text-[#424245]">{JSON.stringify({ latestFlight: flight.name, features, userFlightProfile: profile, baselineExplanation: explanation }, null, 2)}</pre>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ReadinessCard({ icon: Icon, label, value, target, state }: { icon: typeof Database; label: string; value: string; target: string; state: "ready" | "waiting" }) {
  return <div className="bg-white p-5"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#0071e3]" /><span className={`h-2 w-2 rounded-full ${state === "ready" ? "bg-[#34c759]" : "bg-[#d2d2d7]"}`} /></div><p className="mt-5 text-xs font-medium uppercase text-[#86868b]">{label}</p><p className="mt-2 text-3xl font-semibold text-[#1d1d1f]">{value}</p><p className="mt-2 text-xs leading-5 text-[#86868b]">{target}</p></div>;
}

function ModelReadiness({ name, detail, ready }: { name: string; detail: string; ready: boolean }) {
  return <div className="flex gap-3 py-4 first:pt-0 last:pb-0"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ready ? "bg-[#34c759]" : "bg-[#d2d2d7]"}`} /><div><p className="text-sm font-medium text-[#1d1d1f]">{name}</p><p className="mt-1 text-xs leading-5 text-[#86868b]">{detail}</p></div></div>;
}

function PreviewCard({ icon: Icon, title, output, label, body }: { icon: typeof Gauge; title: string; output: string; label: string; body: string }) {
  return <article className="rounded-lg border border-black/[0.08] bg-white p-6"><div className="flex items-center gap-2 text-sm font-medium text-[#6e6e73]"><Icon className="h-4 w-4 text-[#0071e3]" />{title}</div><p className="mt-6 text-4xl font-semibold tracking-tight text-[#1d1d1f]">{output}</p><p className="mt-1 text-sm font-medium text-[#1d1d1f]">{label}</p><p className="mt-4 text-sm leading-6 text-[#6e6e73]">{body}</p><p className="mt-4 inline-flex rounded-full bg-[#f5f5f7] px-3 py-1 text-xs text-[#6e6e73]">Fixed baseline formula</p></article>;
}

function Guardrail({ title, body }: { title: string; body: string }) {
  return <div className="rounded-md bg-[#f5f5f7] p-4"><p className="text-sm font-medium text-[#1d1d1f]">{title}</p><p className="mt-1 text-xs leading-5 text-[#6e6e73]">{body}</p></div>;
}

function ModelRuns({ runs }: { runs: Array<Record<string, unknown>> }) {
  return <section><div className="mb-4"><h2 className="text-2xl font-semibold text-[#1d1d1f]">Stored model runs</h2><p className="mt-1 text-sm text-[#6e6e73]">The latest backend training records and their validation strategy.</p></div><div className="overflow-hidden rounded-lg border border-black/[0.08] bg-white">{runs.slice(0, 6).map((run, index) => <div key={String(run.id ?? index)} className="grid gap-3 border-b border-black/[0.08] p-5 last:border-b-0 md:grid-cols-[1.2fr_1fr_0.7fr]"><div><p className="font-medium text-[#1d1d1f]">{String(run.model_name ?? "Model run")}</p><p className="mt-1 text-xs text-[#86868b]">{String(run.model_type ?? "Unknown algorithm")}</p></div><div><p className="text-xs text-[#86868b]">Validation</p><p className="mt-1 text-sm text-[#1d1d1f]">{String(run.validation_strategy ?? "Not reported")}</p></div><div><p className="text-xs text-[#86868b]">Training rows</p><p className="mt-1 text-sm text-[#1d1d1f]">{String(run.training_rows ?? "—")}</p></div></div>)}</div></section>;
}

function featureCoverage(flights: ReturnType<typeof useUploadedData>["flights"]) {
  const coverage = (test: (flight: (typeof flights)[number]) => boolean) => Math.round((flights.filter(test).length / flights.length) * 100);
  return [
    { name: "Battery", value: coverage((flight) => flight.featureAvailability.batteryAnalytics) },
    { name: "Speed", value: coverage((flight) => flight.featureAvailability.speedChart) },
    { name: "Altitude", value: coverage((flight) => flight.featureAvailability.altitudeChart) },
    { name: "GPS / signal", value: coverage((flight) => flight.featureAvailability.signalStability) },
    { name: "Weather", value: coverage((flight) => Boolean(flight.weatherJoined)) },
  ];
}
