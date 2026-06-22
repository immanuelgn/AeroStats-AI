import type { FlightEvent, TelemetryPoint } from "@/types";
import { formatDistance } from "@/lib/analytics/metrics";

export function TelemetryPanel({ point, event }: { point?: TelemetryPoint; event?: FlightEvent }) {
  const rows = [
    ["Timestamp", point?.timestamp ? new Date(point.timestamp).toLocaleString() : "Unavailable"],
    ["Altitude", point?.altitudeMeters !== undefined ? `${point.altitudeMeters.toFixed(1)} m` : "Unavailable"],
    ["Speed", point?.speedMps !== undefined ? `${point.speedMps.toFixed(1)} m/s` : "Unavailable"],
    ["Battery", point?.batteryPercent !== undefined ? `${point.batteryPercent.toFixed(0)}%` : "Unavailable"],
    ["Distance from home", formatDistance(point?.distanceFromHomeMeters)],
    ["Heading", point?.headingDegrees !== undefined ? `${point.headingDegrees.toFixed(0)} deg` : "Unavailable"],
    ["GPS satellites", point?.gpsSatellites !== undefined ? String(point.gpsSatellites) : "Unavailable"],
    ["Signal", point?.signalStrengthPercent !== undefined ? `${point.signalStrengthPercent.toFixed(0)}%` : "Unavailable"],
    ["Wind estimate", point?.weather?.windSpeedKph !== undefined ? `${point.weather.windSpeedKph.toFixed(0)} kph` : "Join weather first"],
    ["Event", event?.label ?? point?.eventType ?? "None"],
  ];
  return (
    <div className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
      <h3 className="font-semibold text-[#1d1d1f]">Synced telemetry</h3>
      <div className="mt-4 divide-y divide-[#d2d2d7]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-[#86868b]">{label}</span>
            <span className="text-right font-mono text-[#1d1d1f]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
