"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataStatusBanner } from "@/components/common/DataStatusBanner";
import { EmptyState } from "@/components/empty-states/EmptyState";
import { StatCard } from "@/components/dashboard/StatCard";
import { PipelinePreview } from "@/components/dashboard/PipelinePreview";
import { FlightCard } from "@/components/flights/FlightCard";
import { useUploadedData } from "@/lib/storage/DataProvider";
import { dashboardMetrics } from "@/lib/data/summaries";
import { formatDistance, formatDuration } from "@/lib/analytics/metrics";
import { ChartCard } from "@/components/charts/ChartCard";

export default function DashboardPage() {
  const { flights, weatherMode } = useUploadedData();
  const hasData = flights.length > 0;
  const metrics = dashboardMetrics(flights);
  const trend = flights.map((flight) => ({
    name: flight.name,
    drain: flight.metrics.batteryDrainPerMinute,
    risk: flight.metrics.riskScore,
  }));

  return (
    <div className="space-y-6">
      <DataStatusBanner hasData={hasData} />
      <div>
        <h1 className="text-3xl font-semibold text-[#f5f3ec]">Dashboard</h1>
        <p className="mt-2 text-sm text-[#a9b0a6]">Metrics are calculated from uploaded telemetry only.</p>
      </div>

      {!hasData ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard muted label="Total flights" value="No data" />
            <StatCard muted label="Total distance" value="Upload required" />
            <StatCard muted label="Average battery drain" value="Upload required" />
            <StatCard muted label="Risk score" value="Upload required" />
            <StatCard muted label="Latest flight" value="No imported flights" />
          </div>
          <EmptyState title="Upload a flight log to begin analyzing telemetry." body="The dashboard is intentionally empty until you import valid CSV or JSON telemetry with timestamp, latitude, and longitude." />
          <PipelinePreview />
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total flights" value={String(flights.length)} />
            <StatCard label="Total distance" value={formatDistance(metrics.totalDistance)} />
            <StatCard label="Average flight time" value={formatDuration(metrics.avgDuration)} />
            <StatCard label="Average battery drain" value={metrics.avgBatteryDrain !== undefined ? `${metrics.avgBatteryDrain.toFixed(2)}%/min` : "Unavailable"} />
            <StatCard label="Average risk score" value={metrics.avgRisk !== undefined ? `${metrics.avgRisk.toFixed(0)}/100` : "Unavailable"} />
            <StatCard label="Best recent efficiency" value={metrics.bestEfficiency?.name ?? "Unavailable"} detail={metrics.bestEfficiency?.metrics.batteryDrainPer100Meters !== undefined ? `${metrics.bestEfficiency.metrics.batteryDrainPer100Meters.toFixed(2)}% per 100m` : undefined} />
            <StatCard label="Latest flight" value={metrics.latest?.name ?? "Unavailable"} />
            <StatCard label="Next flight window" value={weatherMode === "disabled" ? "Enable weather mode" : "Open forecast"} detail="Shown after forecast data is available." />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Battery drain trend">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend}>
                  <CartesianGrid stroke="#303831" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#7f887d" />
                  <YAxis stroke="#7f887d" />
                  <Tooltip contentStyle={{ background: "#111411", border: "1px solid #303831", color: "#f5f3ec" }} />
                  <Area dataKey="drain" stroke="#98b58a" fill="#98b58a" fillOpacity={0.18} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Risk distribution">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend}>
                  <CartesianGrid stroke="#303831" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#7f887d" />
                  <YAxis stroke="#7f887d" />
                  <Tooltip contentStyle={{ background: "#111411", border: "1px solid #303831", color: "#f5f3ec" }} />
                  <Bar dataKey="risk" fill="#d5a85f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#f5f3ec]">Recent flights</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {flights.slice(-4).reverse().map((flight) => <FlightCard key={flight.id} flight={flight} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
