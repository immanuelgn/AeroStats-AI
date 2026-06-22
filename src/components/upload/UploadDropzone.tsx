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
        dragActive ? "border-[#0071e3] bg-[#0071e3]/10" : "border-[#d2d2d7] bg-[#f5f5f7]/70 hover:border-[#0071e3]/50"
      }`}
    >
      <UploadCloud className="h-10 w-10 text-[#0066cc]" />
      <h2 className="mt-4 text-xl font-semibold text-[#1d1d1f]">{importing ? "Parsing flight telemetry" : "Choose my flight log"}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#6e6e73]">
        Upload CSV, JSON, or a DJI Fly FlightRecord TXT file. Supported DJI logs are decoded locally before normalized telemetry and the original source file are stored privately.
      </p>
      <input type="file" accept=".csv,.json,.txt,.zip" multiple className="sr-only" onChange={(event) => void handle(event.target.files)} />
      <span className="mt-5 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-medium text-white shadow-sm">{importing ? "Processing" : "Choose file"}</span>
    </label>
  );
}
