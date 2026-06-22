export function StatCard({ label, value, detail, muted }: { label: string; value: string; detail?: string; muted?: boolean }) {
  return (
    <div className={`rounded-lg border p-5 ${muted ? "border-dashed border-[#d2d2d7] bg-[#f5f5f7]/55" : "border-black/[0.08] bg-[#ffffff]"}`}>
      <p className="text-xs uppercase text-[#86868b]">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${muted ? "text-[#86868b]" : "text-[#1d1d1f]"}`}>{value}</p>
      {detail ? <p className="mt-2 text-sm text-[#6e6e73]">{detail}</p> : null}
    </div>
  );
}
