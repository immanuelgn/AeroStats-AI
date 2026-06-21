export function RiskBadge({ score }: { score?: number }) {
  if (score === undefined) return <span className="rounded-md border border-[#303831] px-2 py-1 text-xs text-[#7f887d]">Risk unavailable</span>;
  const tone = score > 68 ? "border-[#e07b67]/40 text-[#f0a190]" : score > 42 ? "border-[#d5a85f]/40 text-[#e2c383]" : "border-[#98b58a]/40 text-[#c8d8bd]";
  const label = score > 68 ? "High" : score > 42 ? "Medium" : "Low";
  return <span className={`rounded-md border px-2 py-1 text-xs ${tone}`}>{label} risk {score}</span>;
}
