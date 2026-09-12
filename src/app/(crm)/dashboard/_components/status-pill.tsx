import Link from "next/link";

import type { LucideIcon } from "lucide-react";
export function StatusPill({
  title,
  count,
  status,
  icon: Icon,
  tone,
}: {
  title: string;
  count: number;
  status: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <article aria-label={title} className="min-w-0 rounded-lg border border-slate-200 bg-white">
      <Link
        href={`/orders?status=${status}`}
        className="flex min-h-16 flex-wrap items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Icon className={`size-5 shrink-0 ${tone}`} aria-hidden="true" />
        <span className="flex-1 text-slate-500 text-sm">{title}</span>
        <strong className="text-lg text-slate-800 tabular-nums">{count}</strong>
      </Link>
    </article>
  );
}
