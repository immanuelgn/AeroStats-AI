"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { useUploadedData } from "@/lib/storage/DataProvider";
import type { ParserResult } from "@/types";

export function UploadDropzone({ onResults }: { onResults: (results: ParserResult[]) => void }) {
  const { importFiles, importing } = useUploadedData();
  const [dragActive, setDragActive] = useState(false);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    const results = await importFiles(Array.from(files));
    onResults(results);
  }

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        void handle(event.dataTransfer.files);
      }}
      className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center ${
        dragActive ? "border-[#98b58a] bg-[#98b58a]/10" : "border-[#3a453b] bg-[#151915]/70 hover:border-[#98b58a]/50"
      }`}
    >
      <UploadCloud className="h-10 w-10 text-[#c8d8bd]" />
      <h2 className="mt-4 text-xl font-semibold text-[#f5f3ec]">{importing ? "Parsing uploaded telemetry" : "Upload flight telemetry"}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#a9b0a6]">
        Accepts .csv, .json, .txt, and .zip. CSV/JSON work today with the AeroStats AI internal schema. DJI FlightRecords zip parsing is scaffolded for future support.
      </p>
      <input type="file" accept=".csv,.json,.txt,.zip" multiple className="sr-only" onChange={(event) => void handle(event.target.files)} />
      <span className="mt-5 rounded-md bg-[#f5f3ec] px-4 py-2 text-sm font-medium text-[#111411]">{importing ? "Processing" : "Choose files"}</span>
    </label>
  );
}
