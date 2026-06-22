"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
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
import { getModelStatus, isBackendConfigured, trainModels, type BackendModelStatus } from "@/lib/api/client";

export default function ModelPage() {
  const { flights } = useUploadedData();
  const [backendStatus, setBackendStatus] = useState<BackendModelStatus | null>(null);
  const [trainingState, setTrainingState] = useState("");
  const flight = latestFlight(flights);

  useEffect(() => {
    if (!isBackendConfigured()) return;
    getModelStatus().then(setBackendStatus).catch((error) => setTrainingState(error instanceof Error ? error.message : "Backend status unavailable."));
  }, []);

  async function train() {
    setTrainingState("Backend waking up or training models. Render free services may cold-start.");
    try {
      await trainModels("all");
      const status = await getModelStatus();
      setBackendStatus(status);
      setTrainingState("Training request completed. Confidence remains conservative until validation supports it.");
    } catch (error) {
      setTrainingState(error instanceof Error ? error.message : "Training failed.");
    }
  }

  if (!flight) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-[#1d1d1f]">ML insights</h1>
          <p className="mt-2 text-sm text-[#6e6e73]">This page will document how prediction quality changes as my flight history grows.</p>
        </div>
        <PipelinePreview />
        <BackendModelPanel status={backendStatus} trainingState={trainingState} onTrain={train} disabled={!isBackendConfigured()} />
        <EmptyState title="The ML pipeline is ready for my flight data." body="The app deliberately shows no fabricated accuracy. Training, validation metrics, and confidence will appear after enough real telemetry is available." />
        <Architecture />
      </div>
    );
  }

  const features = buildFeaturesFromFlight(flight);
  const battery = predictBatteryUsage(features);
  const risk = classifyFlightRisk(features);
  const anomalies = detectFlightAnomalies(flight.telemetry);
  const explanation = explainPrediction(features, battery);
  const importance = calculateFeatureImportance(flights);
  const profile = buildUserFlightProfile(flights);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#1d1d1f]">ML insights</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6e6e73]">
          Backend ML uses FastAPI, pandas, NumPy, and scikit-learn when configured. Local fallback estimates are capped at Low/Medium confidence unless backend validation supports more.
        </p>
      </div>
      <BackendModelPanel status={backendStatus} trainingState={trainingState} onTrain={train} disabled={!isBackendConfigured()} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ModelCard title="Battery Drain Predictor" output={`${battery.predictedBatteryUsePercent}% predicted use`} confidence={battery.confidence} body={battery.explanation} missing={battery.missingFields} />
        <ModelCard title="Flight Risk Classifier" output={`${risk.riskClass} risk, ${risk.score}/100`} confidence={risk.confidence} body={risk.explanation} missing={risk.missingFields} />
        <ModelCard title="Flight Anomaly Detector" output={`${anomalies.length} anomaly${anomalies.length === 1 ? "" : "ies"}`} confidence={anomalies.length ? "medium" : "low"} body={anomalies.length ? anomalies.map((anomaly) => anomaly.label).join(", ") : "No obvious anomalies detected from available fallback fields. Train the backend IsolationForest for stronger anomaly scoring."} missing={[]} />
        <ModelCard title="Best Flight Window Ranker" output={flights.some((item) => item.weatherJoined) ? "Weather-adjusted ranking available" : "Requires weather or forecast data"} confidence={flights.some((item) => item.weatherJoined) ? "medium" : "low"} body="Ranks windows using wind, gusts, precipitation, temperature, visibility, and uploaded flight profile." missing={flights.some((item) => item.weatherJoined) ? [] : ["weatherWindows"]} />
      </div>

      <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
        <h2 className="font-semibold text-[#1d1d1f]">Feature vector used</h2>
        <pre className="mt-4 overflow-auto rounded-md border border-[#d2d2d7] bg-[#f5f5f7] p-4 text-xs leading-6 text-[#424245]">{JSON.stringify({ latestFlight: flight.name, features, userFlightProfile: profile }, null, 2)}</pre>
      </section>

      {importance.length ? (
        <ChartCard title="Feature importance">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={importance}>
              <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
              <XAxis dataKey="feature" stroke="#86868b" interval={0} angle={-18} height={80} textAnchor="end" />
              <YAxis stroke="#86868b" />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} />
              <Bar dataKey="value" fill="#0071e3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
        <h2 className="font-semibold text-[#1d1d1f]">{explanation.title}</h2>
        <p className="mt-2 text-sm text-[#6e6e73]">Output: {explanation.output}. Confidence: {explanation.confidence}.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {explanation.factors.map((factor) => <p key={factor} className="rounded-md border border-[#d2d2d7] bg-[#ffffff] p-3 text-sm text-[#6e6e73]">{factor}</p>)}
        </div>
      </section>

      <Architecture />
    </div>
  );
}

function ModelCard({ title, output, confidence, body, missing }: { title: string; output: string; confidence: string; body: string; missing: string[] }) {
  return (
    <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-[#1d1d1f]">{title}</h2>
        <span className="rounded-md border border-[#d2d2d7] px-2 py-1 text-xs text-[#6e6e73]">{confidence} confidence</span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-[#1d1d1f]">{output}</p>
      <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{body}</p>
      {missing.length ? <p className="mt-3 text-sm text-[#0071e3]">Missing fields reducing confidence: {missing.join(", ")}</p> : null}
    </section>
  );
}

function Architecture() {
  return (
    <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
      <h2 className="font-semibold text-[#1d1d1f]">Validation strategy</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          "FastAPI backend trains scikit-learn models from uploaded telemetry and weather-joined features.",
          "Segment-level rows increase sample size while grouped validation avoids same-flight leakage.",
          "Risk classification is weakly supervised until true human labels exist.",
          "High confidence is blocked unless validation, feature completeness, flight count, and uncertainty support it.",
        ].map((item) => <p key={item} className="rounded-md border border-[#d2d2d7] bg-[#ffffff] p-3 text-sm text-[#6e6e73]">{item}</p>)}
      </div>
    </section>
  );
}

function BackendModelPanel({
  status,
  trainingState,
  onTrain,
  disabled,
}: {
  status: BackendModelStatus | null;
  trainingState: string;
  onTrain: () => void;
  disabled: boolean;
}) {
  return (
    <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold text-[#1d1d1f]">Backend ML status</h2>
          <p className="mt-1 text-sm text-[#6e6e73]">
            {disabled ? "Set NEXT_PUBLIC_API_BASE_URL to enable FastAPI training." : status ? `Backend ${status.backend}. Artifacts: ${status.modelArtifactStorage}.` : "Backend waking up..."}
          </p>
        </div>
        <button disabled={disabled} onClick={onTrain} className="rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:opacity-50">
          Train / Retrain models
        </button>
      </div>
      {status ? (
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric label="Supabase" value={status.supabaseConfigured ? "Configured" : "Missing env"} />
          <Metric label="Loaded artifacts" value={String(status.loadedArtifacts.length)} />
          <Metric label="Model runs" value={String(status.latestModelRuns.length)} />
          <Metric label="Confidence rule" value="Conservative" />
        </div>
      ) : null}
      {trainingState ? <p className="mt-4 text-sm text-[#0071e3]">{trainingState}</p> : null}
      <p className="mt-4 text-xs leading-5 text-[#86868b]">
        Upload at least 5-10 flights with battery, speed, altitude, GPS/signal, and joined weather for stronger confidence.
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d2d2d7] bg-[#ffffff] p-3">
      <p className="text-xs text-[#86868b]">{label}</p>
      <p className="mt-1 text-sm text-[#1d1d1f]">{value}</p>
    </div>
  );
}
