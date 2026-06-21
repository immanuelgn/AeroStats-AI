export function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#171a18] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="font-semibold text-[#f5f3ec]">{title}</h3>
        {note ? <span className="text-xs text-[#7f887d]">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}
