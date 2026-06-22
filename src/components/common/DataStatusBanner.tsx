import Link from "next/link";

export function DataStatusBanner({ hasData }: { hasData: boolean }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-4 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-medium text-[#1d1d1f]">{hasData ? "My flight dataset is active" : "Add my first flight to begin the analysis."}</p>
        <p className="mt-1 text-xs text-[#6e6e73]">
          Replay, charts, weather context, and model validation unlock as supported telemetry is added.
        </p>
      </div>
      <Link href="/upload" className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077ed]">
        Add flight
      </Link>
    </div>
  );
}
