const steps = ["Upload", "Parse", "Normalize", "Analyze", "Replay", "Predict"];

export function PipelinePreview() {
  return (
    <div className="rounded-lg border border-black/[0.08] bg-[#ffffff] p-5">
      <p className="text-sm font-medium text-[#1d1d1f]">Telemetry pipeline</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-6">
        {steps.map((step) => (
          <div key={step} className="rounded-md border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-3 text-center text-xs text-[#6e6e73]">
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
