import type { FlightEvent } from "@/types";

const severityStyle = {
  info: "border-[#d2d2d7] bg-[#ffffff]",
  caution: "border-[#9ecbff]/70 bg-[#f5faff]",
  warning: "border-[#f5c542]/70 bg-[#fff8e5]",
};

export function EventTimeline({ events, onJump }: { events: FlightEvent[]; onJump?: (index: number) => void }) {
  return (
    <section className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
      <h3 className="font-semibold text-[#1d1d1f]">Event timeline</h3>
      <div className="mt-4 space-y-3">
        {events.map((event) => (
          <button
            key={event.id}
            onClick={() => onJump?.(event.telemetryIndex)}
            className={`block w-full rounded-md border p-3 text-left hover:border-[#0071e3]/40 ${severityStyle[event.severity]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#1d1d1f]">{event.label}</span>
              <span className="font-mono text-xs text-[#86868b]">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            {event.description ? <p className="mt-1 text-xs text-[#6e6e73]">{event.description}</p> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
