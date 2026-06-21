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
        <ChartCard title="Battery over time">
          <MiniArea data={data} dataKey="battery" color="#98b58a" />
        </ChartCard>
      ) : null}
      {flight.featureAvailability.altitudeChart || flight.featureAvailability.speedChart ? (
        <ChartCard title="Altitude and speed">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid stroke="#303831" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="#7f887d" minTickGap={24} />
              <YAxis stroke="#7f887d" />
              <Tooltip contentStyle={{ background: "#111411", border: "1px solid #303831", color: "#f5f3ec" }} />
              {flight.featureAvailability.altitudeChart ? <Line type="monotone" dataKey="altitude" stroke="#d5a85f" dot={false} strokeWidth={2} /> : null}
              {flight.featureAvailability.speedChart ? <Line type="monotone" dataKey="speed" stroke="#98b58a" dot={false} strokeWidth={2} /> : null}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
      {flight.featureAvailability.distanceChart ? (
        <ChartCard title="Distance from home">
          <MiniArea data={data} dataKey="distance" color="#d5a85f" />
        </ChartCard>
      ) : null}
      <ChartCard title="Event distribution" note="Derived from telemetry">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={flight.events.map((event) => ({ label: event.label, index: event.telemetryIndex }))}>
            <CartesianGrid stroke="#303831" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#7f887d" interval={0} angle={-20} height={70} textAnchor="end" />
            <YAxis stroke="#7f887d" />
            <Tooltip contentStyle={{ background: "#111411", border: "1px solid #303831", color: "#f5f3ec" }} />
            <Bar dataKey="index" fill="#98b58a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function MiniArea({ data, dataKey, color }: { data: Record<string, unknown>[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <CartesianGrid stroke="#303831" strokeDasharray="3 3" />
        <XAxis dataKey="time" stroke="#7f887d" minTickGap={24} />
        <YAxis stroke="#7f887d" />
        <Tooltip contentStyle={{ background: "#111411", border: "1px solid #303831", color: "#f5f3ec" }} />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
