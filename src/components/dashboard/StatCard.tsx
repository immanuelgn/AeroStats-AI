export function StatCard({ label, value, detail, muted }: { label: string; value: string; detail?: string; muted?: boolean }) {
  return (
    <div className={`rounded-lg border p-5 ${muted ? "border-dashed border-[#303831] bg-[#151915]/55" : "border-white/10 bg-[#171a18]"}`}>
      <p className="text-xs uppercase text-[#7f887d]">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${muted ? "text-[#7f887d]" : "text-[#f5f3ec]"}`}>{value}</p>
      {detail ? <p className="mt-2 text-sm text-[#a9b0a6]">{detail}</p> : null}
    </div>
  );
}
