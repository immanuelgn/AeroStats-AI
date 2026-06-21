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
        <h1 className="text-3xl font-semibold text-[#f5f3ec]">Upload/import</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a9b0a6]">
          Upload an AeroStats AI CSV or JSON telemetry file now. When the backend is configured, files are validated, parsed, stored in Supabase Storage, summarized in Postgres, and prepared for feature extraction.
        </p>
      </div>
      <UploadDropzone onResults={(results) => setLatestResult(results[results.length - 1])} />
      <ParserStatusCard result={latestResult} />
      <PipelinePreview />
      <div className="rounded-lg border border-[#d5a85f]/30 bg-[#d5a85f]/10 p-4 text-sm leading-6 text-[#e2c383]">
        AeroStats AI provides estimates based on uploaded telemetry and weather data. Always follow local drone regulations, check official airspace tools, maintain visual line of sight, and use your own judgment before flying.
      </div>
    </div>
  );
}
