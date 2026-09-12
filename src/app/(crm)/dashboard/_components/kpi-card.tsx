import type { LucideIcon } from "lucide-react";

import type { MetricWithDelta } from "@/lib/crm-types";

import { dashboardMoney, dashboardNumber, deltaArrow, deltaBadgeClass } from "./dashboard-format";
export function KpiCard({
  title,
  metric,
  icon: Icon,
  tone,
  money = false,
  comparison,
}: {
  title: string;
  metric: MetricWithDelta;
  icon: LucideIcon;
  tone: string;
  money?: boolean;
  comparison: boolean;
}) {
  const format = money ? dashboardMoney : dashboardNumber;
  let caption = "Нет базы для сравнения";
  if (!comparison) caption = "За всё время · без сравнения";
  else if (metric.deltaAbs !== null)
    caption = `${metric.deltaAbs > 0 ? "+" : ""}${format(metric.deltaAbs)} к прошлому периоду`;
  return (
    <article aria-label={title} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`flex size-9 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold text-xs ${deltaBadgeClass(metric.delta)}`}>
          {deltaArrow(metric.delta)}
          {metric.delta === null ? "" : ` ${dashboardNumber(Math.abs(metric.delta))}%`}
        </span>
      </div>
      <h2 className="mt-3 font-medium text-slate-500 text-sm">{title}</h2>
      <p className="mt-1 break-words font-extrabold text-3xl text-slate-800 tabular-nums tracking-tight">
        {format(metric.value)}
      </p>
      <p className="mt-2 text-slate-500 text-xs leading-5">{caption}</p>
    </article>
  );
}
