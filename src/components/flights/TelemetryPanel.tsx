import type { FlightEvent, TelemetryPoint } from "@/types";
import { formatDistance } from "@/lib/analytics/metrics";
import { getAltitudeReferenceNote, getTelemetryQualityWarning, isUnreliableAltitudePoint } from "@/lib/data/quality";

export function TelemetryPanel({
  point,
  previousPoint,
  event,
  variant = "card",
}: {
  point?: TelemetryPoint;
  previousPoint?: TelemetryPoint;
  event?: FlightEvent;
  variant?: "card" | "overlay";
}) {
  const qualityWarning = getTelemetryQualityWarning(point, previousPoint);
  const altitudeReferenceNote = getAltitudeReferenceNote(point, previousPoint);
  const telemetryEventLabel = isUnreliableAltitudePoint(point, previousPoint) ? "Telemetry anomaly" : undefined;
  const isOverlay = variant === "overlay";
  const weatherMissingLabel = point?.weather ? "Not available" : "Join weather first";
  const rows = [
    ["Timestamp", point?.timestamp ? new Date(point.timestamp).toLocaleString() : "Unavailable"],
    ["Altitude", point?.altitudeMeters !== undefined ? `${point.altitudeMeters.toFixed(1)} m` : "Unavailable"],
    ["Speed", point?.speedMps !== undefined ? `${point.speedMps.toFixed(1)} m/s` : "Unavailable"],
    ["Battery", point?.batteryPercent !== undefined ? `${point.batteryPercent.toFixed(0)}%` : "Unavailable"],
    ["Distance from home", formatDistance(point?.distanceFromHomeMeters)],
    ["Heading", point?.headingDegrees !== undefined ? `${point.headingDegrees.toFixed(0)} deg` : "Unavailable"],
    ["GPS satellites", point?.gpsSatellites !== undefined ? String(point.gpsSatellites) : "Unavailable"],
    ["Signal", point?.signalStrengthPercent !== undefined ? `${point.signalStrengthPercent.toFixed(0)}%` : "Unavailable"],
    ["Wind estimate", point?.weather?.windSpeedKph !== undefined ? `${point.weather.windSpeedKph.toFixed(0)} kph` : weatherMissingLabel],
    ["Temperature", point?.weather?.temperatureCelsius !== undefined ? `${point.weather.temperatureCelsius.toFixed(1)} C` : weatherMissingLabel],
    ["Visibility", point?.weather?.visibilityMeters !== undefined ? formatDistance(point.weather.visibilityMeters) : weatherMissingLabel],
    ["Event", event?.label ?? point?.eventType ?? telemetryEventLabel ?? "None"],
  ];
  return (
    <div
      className={
        isOverlay
          ? "max-h-full overflow-y-auto rounded-lg border border-white/70 bg-white/88 p-3.5 shadow-[0_16px_42px_rgba(0,0,0,0.14)] backdrop-blur-xl"
          : "rounded-lg border border-black/[0.08] bg-[#ffffff] p-5"
      }
    >
      <h3 className={`font-semibold text-[#1d1d1f] ${isOverlay ? "text-[13px]" : ""}`}>Synced telemetry</h3>
      <div className={`${isOverlay ? "mt-2.5" : "mt-4"} divide-y divide-[#d2d2d7]`}>
        {rows.map(([label, value]) => (
          <div key={label} className={`flex items-center justify-between gap-3 ${isOverlay ? "py-1 text-[11px]" : "py-2 text-sm"}`}>
            <span className="text-[#86868b]">{label}</span>
            <span className="text-right font-mono text-[#1d1d1f]">{value}</span>
          </div>
        ))}
      </div>
      {qualityWarning ? (
        <div className={`${isOverlay ? "mt-2.5 p-2 text-[10px] leading-4" : "mt-4 p-3 text-xs leading-5"} rounded-md border border-[#f5c542]/50 bg-[#fff8e5] text-[#6b4a00]`}>
          <span className="font-semibold">Telemetry quality warning: </span>
          {qualityWarning}
        </div>
      ) : null}
      {altitudeReferenceNote ? (
        <div className={`${isOverlay ? "mt-2.5 p-2 text-[10px] leading-4" : "mt-4 p-3 text-xs leading-5"} rounded-md border border-[#9ecbff]/60 bg-[#f5faff] text-[#0057a8]`}>
          <span className="font-semibold">Altitude reference note: </span>
          {altitudeReferenceNote}
        </div>
      ) : null}
    </div>
  );
}
