import type { FlightEvent } from "@/types";

export function EventTimeline({ events, onJump }: { events: FlightEvent[]; onJump?: (index: number) => void }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#171a18] p-5">
      <h3 className="font-semibold text-[#f5f3ec]">Event timeline</h3>
      <div className="mt-4 space-y-3">
        {events.map((event) => (
          <button key={event.id} onClick={() => onJump?.(event.telemetryIndex)} className="block w-full rounded-md border border-[#303831] bg-[#111411] p-3 text-left hover:border-[#98b58a]/40">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#f5f3ec]">{event.label}</span>
              <span className="font-mono text-xs text-[#7f887d]">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            {event.description ? <p className="mt-1 text-xs text-[#a9b0a6]">{event.description}</p> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
