"use client";

import { Pause, Play } from "lucide-react";

export function FlightReplayControls({
  playing,
  currentIndex,
  maxIndex,
  speed,
  onToggle,
  onSeek,
  onSpeed,
}: {
  playing: boolean;
  currentIndex: number;
  maxIndex: number;
  speed: number;
  onToggle: () => void;
  onSeek: (index: number) => void;
  onSpeed: (speed: number) => void;
}) {
  return (
    <div className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <button onClick={onToggle} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0077ed]">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Pause" : "Play"}
        </button>
        <input className="w-full accent-[#0071e3]" type="range" min={0} max={maxIndex} value={currentIndex} onChange={(event) => onSeek(Number(event.target.value))} />
        <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))} className="rounded-md border border-[#d2d2d7] bg-[#ffffff] px-3 py-2 text-sm text-[#1d1d1f]">
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
      </div>
      <p className="mt-3 text-xs text-[#86868b]">Replay is generated only from uploaded telemetry points.</p>
    </div>
  );
}
