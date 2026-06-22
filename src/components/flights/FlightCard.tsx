import Link from "next/link";
import type { FlightRecord } from "@/types";
import { formatDistance, formatDuration } from "@/lib/analytics/metrics";
import { RiskBadge } from "@/components/flights/RiskBadge";
import { flightDisplayName } from "@/lib/data/summaries";

export function FlightCard({ flight }: { flight: FlightRecord }) {
  return (
    <Link href={`/flights/${flight.id}`} className="block rounded-lg border border-black/[0.08] bg-[#ffffff] p-5 hover:border-[#0071e3]/40 hover:bg-[#f5f5f7]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[#1d1d1f]">{flightDisplayName(flight)}</p>
          <p className="mt-1 text-sm text-[#6e6e73]">{flight.metadata.startTime ? new Date(flight.metadata.startTime).toLocaleString() : "Date unavailable"}</p>
          <p className="mt-1 text-xs text-[#86868b]">{flight.metadata.locationLabel ?? "Location not detected"}</p>
        </div>
        <RiskBadge score={flight.metrics.riskScore} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="Duration" value={formatDuration(flight.metrics.durationSeconds)} />
        <Metric label="Distance" value={formatDistance(flight.metrics.totalDistanceMeters)} />
        <Metric label="Battery used" value={flight.metrics.batteryUsedPercent !== undefined ? `${flight.metrics.batteryUsedPercent.toFixed(1)}%` : "Unavailable"} />
        <Metric label="Points" value={String(flight.telemetry.length)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {flight.tags.map((tag) => (
          <span key={tag} className="rounded-md border border-[#d2d2d7] px-2 py-1 text-xs text-[#6e6e73]">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#86868b]">{label}</p>
      <p className="mt-1 text-[#1d1d1f]">{value}</p>
    </div>
  );
}
