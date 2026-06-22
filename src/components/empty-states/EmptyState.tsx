import Link from "next/link";
import { Upload } from "lucide-react";

export function EmptyState({
  title,
  body,
  action = "Add flight",
  href = "/upload",
}: {
  title: string;
  body: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#d2d2d7] bg-[#f5f5f7]/70 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-[#0071e3]/30 bg-[#0071e3]/10">
        <Upload className="h-5 w-5 text-[#0066cc]" />
      </div>
      <h2 className="text-xl font-semibold text-[#1d1d1f]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#6e6e73]">{body}</p>
      <Link href={href} className="mt-5 inline-flex rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0077ed]">
        {action}
      </Link>
    </div>
  );
}
