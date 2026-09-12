"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import type { ResultsData } from "../../../../../server/analytics/results-calculations";
import { amount, percent } from "./format";

export function KpiGrid({ kpis }: { kpis: ResultsData["kpis"] }) {
  const cards = [
    { key: "revenue", label: "Валовый доход", money: true },
    { key: "units", label: "Продажи в штуках", money: false },
    { key: "profit", label: "Чистая прибыль", money: true },
    { key: "average", label: "Средний чек", money: true },
  ] as const;
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ key, label, money }) => {
        const metric = kpis[key];
        let tone = "bg-slate-100 text-slate-700";
        if (metric.percent !== null && metric.percent > 0) tone = "bg-emerald-50 text-emerald-800";
        if (metric.percent !== null && metric.percent < 0) tone = "bg-rose-50 text-rose-800";
        return (
          <Card key={key} className="min-w-0">
            <CardHeader>
              <h2 className="font-semibold text-muted-foreground text-sm">{label}</h2>
            </CardHeader>
            <CardContent>
              <p className="break-words font-extrabold text-2xl tabular-nums tracking-tight">
                {amount(metric.value, money)}
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-md px-2 py-1 font-bold ${tone}`}>{percent(metric.percent)}</span>
                <span>
                  {metric.delta === null
                    ? "Сравнение недоступно"
                    : `${metric.delta > 0 ? "+" : ""}${amount(metric.delta, money)}`}
                </span>
              </p>
              <p className="mt-2 text-muted-foreground text-xs">Ранее: {amount(metric.previous, money)}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
