import Link from "next/link";

export function DataStatusBanner({ hasData, loading = false }: { hasData: boolean; loading?: boolean }) {
  const title = loading ? "Loading the shared flight dataset." : hasData ? "My flight dataset is active" : "Add my first flight to begin the analysis.";
  const body = loading
    ? "The backend may take up to a minute to wake. If the flights still do not appear, refresh once."
    : "Replay, charts, weather context, and model validation unlock as supported telemetry is added.";

  return (
    <div className="mb-6 flex flex-col justify-between gap-3 rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-4 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-medium text-[#1d1d1f]">{title}</p>
        <p className="mt-1 text-xs text-[#6e6e73]">{body}</p>
      </div>
      {loading ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0066cc]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#0071e3]" />
          Syncing
        </span>
      ) : (
        <Link href="/upload" className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077ed]">
          Add flight
        </Link>
      )}
    </div>
  );
}
