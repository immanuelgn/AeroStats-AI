export function RiskBadge({ score }: { score?: number }) {
  if (score === undefined) return <span className="rounded-md border border-[#d2d2d7] px-2 py-1 text-xs text-[#86868b]">Risk unavailable</span>;
  const tone = score > 68 ? "border-[#1d1d1f]/40 text-[#1d1d1f]" : score > 42 ? "border-[#0071e3]/40 text-[#0066cc]" : "border-[#0071e3]/40 text-[#0066cc]";
  const label = score > 68 ? "High" : score > 42 ? "Medium" : "Low";
  return <span className={`rounded-md border px-2 py-1 text-xs ${tone}`}>{label} risk {score}</span>;
}
