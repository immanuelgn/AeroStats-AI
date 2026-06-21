import Link from "next/link";
import type { FlightRecord } from "@/types";
import { formatDistance, formatDuration } from "@/lib/analytics/metrics";
import { RiskBadge } from "@/components/flights/RiskBadge";

export function FlightCard({ flight }: { flight: FlightRecord }) {
  return (
    <Link href={`/flights/${flight.id}`} className="block rounded-lg border border-white/10 bg-[#171a18] p-5 hover:border-[#98b58a]/40 hover:bg-[#1b201c]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[#f5f3ec]">{flight.name}</p>
          <p className="mt-1 text-sm text-[#a9b0a6]">{flight.metadata.startTime ? new Date(flight.metadata.startTime).toLocaleString() : "Date unavailable"}</p>
          <p className="mt-1 text-xs text-[#7f887d]">{flight.metadata.locationLabel ?? "Location not detected"}</p>
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
          <span key={tag} className="rounded-md border border-[#303831] px-2 py-1 text-xs text-[#a9b0a6]">
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
      <p className="text-xs text-[#7f887d]">{label}</p>
      <p className="mt-1 text-[#f5f3ec]">{value}</p>
    </div>
  );
}
