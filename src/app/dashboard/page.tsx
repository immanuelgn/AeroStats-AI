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
        <h1 className="text-3xl font-semibold text-[#1d1d1f]">Dashboard</h1>
        <p className="mt-2 text-sm text-[#6e6e73]">A single view of my recorded flights, derived telemetry, efficiency trends, and model-ready history.</p>
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
          <EmptyState title="My first flight will start the dataset." body="Once a supported flight log is imported, this dashboard will show replay, performance trends, and the growing evidence used to validate the ML models." />
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
                  <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#86868b" />
                  <YAxis stroke="#86868b" />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} />
                  <Area dataKey="drain" stroke="#0071e3" fill="#0071e3" fillOpacity={0.18} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Risk distribution">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend}>
                  <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#86868b" />
                  <YAxis stroke="#86868b" />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} />
                  <Bar dataKey="risk" fill="#0071e3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-[#1d1d1f]">Recent flights</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {flights.slice(-4).reverse().map((flight) => <FlightCard key={flight.id} flight={flight} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
