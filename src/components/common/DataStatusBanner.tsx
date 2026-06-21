import Link from "next/link";

export function DataStatusBanner({ hasData }: { hasData: boolean }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 rounded-lg border border-[#303831] bg-[#151915] p-4 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-medium text-[#f5f3ec]">{hasData ? "Uploaded data active" : "Upload a flight log to begin analyzing telemetry."}</p>
        <p className="mt-1 text-xs text-[#a9b0a6]">
          AeroStats AI starts empty and unlocks replay, charts, weather joins, and baseline models only after valid telemetry is imported.
        </p>
      </div>
      <Link href="/upload" className="rounded-md border border-[#98b58a]/40 px-3 py-2 text-sm text-[#dfe8d7] hover:bg-[#98b58a]/10">
        Upload
      </Link>
    </div>
  );
}
