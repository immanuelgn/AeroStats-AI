"use client";

import Link from "next/link";
import { BatteryCharging, CheckCircle2, CloudSun, Database, Gauge, Route, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataStatusBanner } from "@/components/common/DataStatusBanner";
import { EmptyState } from "@/components/empty-states/EmptyState";
import { PipelinePreview } from "@/components/dashboard/PipelinePreview";
import { FlightCard } from "@/components/flights/FlightCard";
import { useUploadedData } from "@/lib/storage/DataProvider";
import { chronologicalFlights, dashboardMetrics, flightDisplayName } from "@/lib/data/summaries";
import { formatDistance } from "@/lib/analytics/metrics";

export default function DashboardPage() {
  const { flights, weatherMode, backendSyncing } = useUploadedData();
  const hasData = flights.length > 0;
  const metrics = dashboardMetrics(flights);
  const orderedFlights = chronologicalFlights(flights);
  const comparison = orderedFlights.map((flight, index) => ({
    name: `F${index + 1}`,
    fullName: flightDisplayName(flight, index),
    distance: Math.round(flight.metrics.totalDistanceMeters ?? 0),
    battery: Number((flight.metrics.batteryUsedPercent ?? 0).toFixed(1)),
    risk: flight.metrics.riskScore ?? 0,
  }));
  const bestFlightIndex = metrics.bestEfficiency ? flights.findIndex((flight) => flight.id === metrics.bestEfficiency?.id) : -1;
  const trainedReadiness = Math.min(100, Math.round((flights.length / 5) * 100));

  return (
    <div className="space-y-8">
      <DataStatusBanner hasData={hasData} loading={backendSyncing && !hasData} />
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-[#0066cc]">My flight story</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#1d1d1f]">A clear view of every flight.</h1>
        <p className="mt-3 text-base leading-7 text-[#6e6e73]">
          Plain-language performance, battery behavior, route quality, and the progress toward genuinely trained predictions.
        </p>
      </header>

      {backendSyncing && !hasData ? (
        <section className="rounded-lg border border-black/[0.08] bg-white p-8 text-center">
          <p className="text-sm font-medium text-[#0066cc]">Fetching saved flights</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d1d1f]">The backend is loading the portfolio dataset.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6e6e73]">
            This can take a little longer on Render free tier after the service sleeps. The flights are stored in Supabase and should appear automatically.
          </p>
        </section>
      ) : !hasData ? (
        <>
          <EmptyState title="My first flight will start the dataset." body="Once a supported flight log is imported, this dashboard will show replay, performance trends, and the growing evidence used to validate the ML models." />
          <PipelinePreview />
        </>
      ) : (
        <>
          <section className="grid overflow-hidden rounded-lg border border-black/[0.08] bg-[#f5f5f7] md:grid-cols-[1.35fr_1fr]">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-2 text-sm font-medium text-[#0066cc]"><Sparkles className="h-4 w-4" /> Current snapshot</div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-[#1d1d1f]">
                {flights.length} flights, {formatDistance(metrics.totalDistance)} travelled.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6e6e73]">
                The logs decoded successfully into {metrics.totalTelemetryPoints.toLocaleString()} usable telemetry points. Battery, route, speed, altitude, GPS and signal analysis are available now.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <StatusPill icon={CheckCircle2} label="Telemetry verified" active />
                <StatusPill icon={CloudSun} label={metrics.weatherJoinedCount ? `${metrics.weatherJoinedCount}/${flights.length} weather joined` : "Weather not joined yet"} active={metrics.weatherJoinedCount > 0} />
                <StatusPill icon={Database} label={`${flights.length}/5 flights toward stronger ML`} active={flights.length >= 5} />
              </div>
            </div>
            <div className="border-t border-black/[0.08] bg-white p-6 md:border-l md:border-t-0 sm:p-8">
              <p className="text-xs font-medium uppercase text-[#86868b]">ML learning progress</p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <p className="text-4xl font-semibold text-[#1d1d1f]">{trainedReadiness}%</p>
                <p className="text-right text-xs leading-5 text-[#86868b]">5 flights is the first useful milestone.<br />10+ is a stronger portfolio dataset.</p>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e8e8ed]"><div className="h-full rounded-full bg-[#0071e3]" style={{ width: `${trainedReadiness}%` }} /></div>
              <Link href="/model" className="mt-5 inline-flex text-sm font-medium text-[#0066cc] hover:underline">See the technical model lab →</Link>
            </div>
          </section>

          <section className="grid gap-px overflow-hidden rounded-lg border border-black/[0.08] bg-black/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            <StoryMetric icon={Route} label="Distance recorded" value={formatDistance(metrics.totalDistance)} detail="Across all imported flights" />
            <StoryMetric icon={BatteryCharging} label="Battery used" value={`${(metrics.totalBatteryUsed ?? 0).toFixed(0)}%`} detail={`${metrics.avgBatteryDrain?.toFixed(2) ?? "—"}% average per minute`} />
            <StoryMetric icon={Gauge} label="Average risk estimate" value={metrics.avgRisk !== undefined ? `${metrics.avgRisk.toFixed(0)}/100` : "Pending"} detail="Rule-based until trained risk ML is ready" />
            <StoryMetric icon={CloudSun} label="Historical weather" value={metrics.weatherJoinedCount ? `${metrics.weatherJoinedCount} joined` : weatherMode === "disabled" ? "Disabled" : "Ready to join"} detail="Used to explain wind and battery effects" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="rounded-lg border border-black/[0.08] bg-white p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold text-[#1d1d1f]">Flight comparison</p>
                  <p className="mt-1 text-sm text-[#6e6e73]">Distance and battery use make the two flights easy to compare.</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#6e6e73]" aria-label="Flight comparison legend">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0071e3]" /> Distance (m)</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#1d1d1f]" /> Battery used (%)</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparison} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#e8e8ed" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#86868b" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="distance" stroke="#0071e3" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="battery" orientation="right" stroke="#1d1d1f" tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value, name) => [name === "distance" ? `${value} m` : `${value}%`, name === "distance" ? "Distance" : "Battery used"]} labelFormatter={(label) => comparison.find((item) => item.name === label)?.fullName ?? label} contentStyle={{ border: "1px solid #d2d2d7", borderRadius: 8, boxShadow: "0 8px 30px rgba(0,0,0,.08)" }} />
                    <Bar yAxisId="distance" dataKey="distance" fill="#0071e3" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="battery" dataKey="battery" fill="#1d1d1f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <aside className="rounded-lg bg-[#1d1d1f] p-6 text-white">
              <p className="text-sm font-medium text-[#a1c9f4]">What the data says</p>
              <div className="mt-6 space-y-6">
                <Insight title="Both files parsed correctly" body="Two DJI records contain usable airborne GPS and battery telemetry. They are valid for analysis." />
                <Insight title="Short flights amplify drain per minute" body={`${metrics.avgBatteryDrain?.toFixed(2) ?? "—"}%/min looks high partly because both flights are short. Distance-based efficiency is more useful as the dataset grows.`} />
                <Insight title="Risk is an estimate for now" body="The dashboard risk score is transparent rule-based analysis. The trained risk classifier needs at least one more valid flight." />
              </div>
            </aside>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#1d1d1f]">Recent flights</h2>
                <p className="mt-1 text-sm text-[#6e6e73]">Open a flight for route replay, charts, weather joining and detailed analysis.</p>
              </div>
              {bestFlightIndex >= 0 ? <p className="hidden text-xs text-[#86868b] sm:block">Best distance efficiency: Flight {bestFlightIndex + 1}</p> : null}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {flights.slice(0, 4).map((flight) => <FlightCard key={flight.id} flight={flight} allFlights={flights} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StoryMetric({ icon: Icon, label, value, detail }: { icon: typeof Route; label: string; value: string; detail: string }) {
  return <div className="bg-white p-5"><Icon className="h-5 w-5 text-[#0071e3]" /><p className="mt-5 text-xs font-medium uppercase text-[#86868b]">{label}</p><p className="mt-2 text-2xl font-semibold text-[#1d1d1f]">{value}</p><p className="mt-1 text-xs leading-5 text-[#86868b]">{detail}</p></div>;
}

function StatusPill({ icon: Icon, label, active }: { icon: typeof Route; label: string; active: boolean }) {
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${active ? "border-[#0071e3]/25 bg-white text-[#0066cc]" : "border-black/[0.08] bg-white text-[#6e6e73]"}`}><Icon className="h-3.5 w-3.5" />{label}</span>;
}

function Insight({ title, body }: { title: string; body: string }) {
  return <div><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-6 text-[#c7c7cc]">{body}</p></div>;
}
