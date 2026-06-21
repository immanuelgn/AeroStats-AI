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
    <div className="rounded-lg border border-white/10 bg-[#171a18] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <button onClick={onToggle} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#f5f3ec] px-4 py-2 text-sm font-medium text-[#111411] hover:bg-[#dfe8d7]">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Pause" : "Play"}
        </button>
        <input className="w-full accent-[#98b58a]" type="range" min={0} max={maxIndex} value={currentIndex} onChange={(event) => onSeek(Number(event.target.value))} />
        <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))} className="rounded-md border border-[#303831] bg-[#111411] px-3 py-2 text-sm text-[#f5f3ec]">
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
      </div>
      <p className="mt-3 text-xs text-[#7f887d]">Replay is generated only from uploaded telemetry points.</p>
    </div>
  );
}
