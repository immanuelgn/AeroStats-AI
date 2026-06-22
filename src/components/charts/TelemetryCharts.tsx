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
          <MiniArea data={data} dataKey="battery" color="#0071e3" />
        </ChartCard>
      ) : null}
      {flight.featureAvailability.altitudeChart || flight.featureAvailability.speedChart ? (
        <ChartCard title="Altitude and speed">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="#86868b" minTickGap={24} />
              <YAxis stroke="#86868b" />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} />
              {flight.featureAvailability.altitudeChart ? <Line type="monotone" dataKey="altitude" stroke="#0071e3" dot={false} strokeWidth={2} /> : null}
              {flight.featureAvailability.speedChart ? <Line type="monotone" dataKey="speed" stroke="#0071e3" dot={false} strokeWidth={2} /> : null}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
      {flight.featureAvailability.distanceChart ? (
        <ChartCard title="Distance from home">
          <MiniArea data={data} dataKey="distance" color="#0071e3" />
        </ChartCard>
      ) : null}
      <ChartCard title="Event distribution" note="Derived from telemetry">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={flight.events.map((event) => ({ label: event.label, index: event.telemetryIndex }))}>
            <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#86868b" interval={0} angle={-20} height={70} textAnchor="end" />
            <YAxis stroke="#86868b" />
            <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} />
            <Bar dataKey="index" fill="#0071e3" radius={[4, 4, 0, 0]} />
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
        <CartesianGrid stroke="#d2d2d7" strokeDasharray="3 3" />
        <XAxis dataKey="time" stroke="#86868b" minTickGap={24} />
        <YAxis stroke="#86868b" />
        <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d2d2d7", color: "#1d1d1f" }} />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
