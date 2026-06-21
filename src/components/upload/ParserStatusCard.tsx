import type { ParserResult } from "@/types";

export function ParserStatusCard({ result }: { result?: ParserResult }) {
  if (!result) {
    return <div className="rounded-lg border border-white/10 bg-[#171a18] p-5 text-sm text-[#a9b0a6]">Parser result summary appears after upload.</div>;
  }
  const rows = [
    ["Detected flights", result.detectedFlights],
    ["Telemetry points", result.telemetryPoints],
    ["GPS availability", result.hasGps ? "Detected" : "Missing"],
    ["Battery availability", result.hasBattery ? "Detected" : "Missing"],
    ["Altitude availability", result.hasAltitude ? "Detected" : "Missing"],
    ["Speed availability", result.hasSpeed ? "Detected" : "Missing"],
    ["Signal/GPS satellite availability", result.hasSignal ? "Detected" : "Missing"],
    ["Parser confidence", `${result.parserConfidence}%`],
  ];
  return (
    <section className="rounded-lg border border-white/10 bg-[#171a18] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#f5f3ec]">Parser result summary</h3>
        <span className="rounded-md border border-[#303831] px-2 py-1 text-xs text-[#a9b0a6]">{result.status}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-[#303831] bg-[#111411] p-3">
            <p className="text-xs text-[#7f887d]">{label}</p>
            <p className="mt-1 text-sm text-[#f5f3ec]">{value}</p>
          </div>
        ))}
      </div>
      {result.dateRange ? <p className="mt-4 text-sm text-[#a9b0a6]">Detected date range: {new Date(result.dateRange.start).toLocaleString()} to {new Date(result.dateRange.end).toLocaleString()}</p> : null}
      {result.missingFields.length ? <p className="mt-3 text-sm text-[#d5a85f]">Missing fields: {result.missingFields.join(", ")}</p> : null}
      {result.warnings.map((warning) => (
        <p key={warning.code} className="mt-2 text-sm text-[#d5a85f]">{warning.message}</p>
      ))}
      <p className="mt-4 text-sm text-[#a9b0a6]">{result.nextRecommendedAction}</p>
    </section>
  );
}
