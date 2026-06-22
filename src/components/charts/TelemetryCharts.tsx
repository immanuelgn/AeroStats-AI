"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FlightRecord } from "@/types";
import { ChartCard } from "@/components/charts/ChartCard";

export function TelemetryCharts({ flight }: { flight: FlightRecord }) {
  const data = flight.telemetry.map((point, index) => ({
    index,
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    battery: point.batteryPercent,
    altitude: point.altitudeMeters,
    speed: point.speedMps,
    distance: point.distanceFromHomeMeters,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {flight.featureAvailability.batteryAnalytics ? (
        <ChartCard title="Battery over time (%)">
          <MiniArea data={data} dataKey="battery" color="#0071e3" unit="%" />
        </ChartCard>
      ) : null}
      {flight.featureAvailability.altitudeChart || flight.featureAvailability.speedChart ? (
        <ChartCard title="Altitude (m) and speed (m/s)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="#86868b" minTickGap={24} />
              <YAxis yAxisId="altitude" stroke="#86868b" tickFormatter={(value) => `${value} m`} width={56} />
              <YAxis yAxisId="speed" orientation="right" stroke="#86868b" tickFormatter={(value) => `${value} m/s`} width={64} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} formatter={chartFormatter} />
              {flight.featureAvailability.altitudeChart ? <Line yAxisId="altitude" type="monotone" name="Altitude" dataKey="altitude" stroke="#0071e3" dot={false} strokeWidth={2} unit=" m" /> : null}
              {flight.featureAvailability.speedChart ? <Line yAxisId="speed" type="monotone" name="Speed" dataKey="speed" stroke="#1d1d1f" dot={false} strokeWidth={2} unit=" m/s" /> : null}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
      {flight.featureAvailability.distanceChart ? (
        <ChartCard title="Distance from home (m)">
          <MiniArea data={data} dataKey="distance" color="#0071e3" unit=" m" />
        </ChartCard>
      ) : null}
      <ChartCard title="Event markers by flight position" note="X axis: event type. Y axis: telemetry point index.">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={flight.events.map((event) => ({ label: event.label, index: event.telemetryIndex }))}>
            <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#86868b" interval={0} angle={-20} height={70} textAnchor="end" />
            <YAxis stroke="#86868b" tickFormatter={(value) => `#${value}`} width={56} />
            <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} formatter={(value) => [`#${value}`, "Telemetry point"]} />
            <Bar dataKey="index" name="Telemetry point" fill="#0071e3" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function MiniArea({ data, dataKey, color, unit }: { data: Record<string, unknown>[]; dataKey: string; color: string; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
        <XAxis dataKey="time" stroke="#86868b" minTickGap={24} />
        <YAxis stroke="#86868b" tickFormatter={(value) => `${value}${unit}`} width={60} />
        <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} formatter={(value, name) => [`${formatNumber(value)}${unit}`, readableMetric(String(name))]} />
        <Area type="monotone" name={readableMetric(dataKey)} dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function chartFormatter(value: unknown, name: unknown) {
  const label = String(name);
  const unit = label === "Speed" ? " m/s" : label === "Altitude" ? " m" : "";
  return [`${formatNumber(value)}${unit}`, label];
}

function readableMetric(metric: string) {
  const labels: Record<string, string> = {
    battery: "Battery",
    altitude: "Altitude",
    speed: "Speed",
    distance: "Distance from home",
  };
  return labels[metric] ?? metric;
}

function formatNumber(value: unknown) {
  return typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : String(value);
}
