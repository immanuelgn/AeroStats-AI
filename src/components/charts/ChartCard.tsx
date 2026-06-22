export function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="font-semibold text-[#1d1d1f]">{title}</h3>
        {note ? <span className="text-xs text-[#86868b]">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}
