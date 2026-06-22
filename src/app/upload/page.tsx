"use client";

import { useState } from "react";
import type { ParserResult } from "@/types";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { ParserStatusCard } from "@/components/upload/ParserStatusCard";
import { PipelinePreview } from "@/components/dashboard/PipelinePreview";

export default function UploadPage() {
  const [latestResult, setLatestResult] = useState<ParserResult | undefined>();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#1d1d1f]">Add a flight</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6e6e73]">
          Add one of my flight logs to the portfolio dataset. Supported files are validated, stored privately in Supabase, normalized for replay, and prepared for feature extraction and model training.
        </p>
      </div>
      <UploadDropzone onResults={(results) => setLatestResult(results[results.length - 1])} />
      <ParserStatusCard result={latestResult} />
      <PipelinePreview />
      <div className="rounded-lg border border-[#0071e3]/30 bg-[#0071e3]/10 p-4 text-sm leading-6 text-[#0066cc]">
        AeroStats AI provides estimates based on uploaded telemetry and weather data. Always follow local drone regulations, check official airspace tools, maintain visual line of sight, and use your own judgment before flying.
      </div>
    </div>
  );
}
