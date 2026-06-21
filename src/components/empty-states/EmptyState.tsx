import Link from "next/link";
import { Upload } from "lucide-react";

export function EmptyState({
  title,
  body,
  action = "Upload Flight Log",
  href = "/upload",
}: {
  title: string;
  body: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#3a453b] bg-[#151915]/70 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-[#98b58a]/30 bg-[#98b58a]/10">
        <Upload className="h-5 w-5 text-[#c8d8bd]" />
      </div>
      <h2 className="text-xl font-semibold text-[#f5f3ec]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#a9b0a6]">{body}</p>
      <Link href={href} className="mt-5 inline-flex rounded-md bg-[#f5f3ec] px-4 py-2 text-sm font-medium text-[#111411] hover:bg-[#dfe8d7]">
        {action}
      </Link>
    </div>
  );
}
