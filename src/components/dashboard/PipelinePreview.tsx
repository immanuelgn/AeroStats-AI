const steps = ["Upload", "Parse", "Normalize", "Analyze", "Replay", "Predict"];

export function PipelinePreview() {
  return (
    <div className="rounded-lg border border-white/10 bg-[#171a18] p-5">
      <p className="text-sm font-medium text-[#f5f3ec]">Telemetry pipeline</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-6">
        {steps.map((step) => (
          <div key={step} className="rounded-md border border-[#303831] bg-[#101310] px-3 py-3 text-center text-xs text-[#a9b0a6]">
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
