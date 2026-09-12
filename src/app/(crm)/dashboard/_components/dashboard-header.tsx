"use client";
import { useRef, useTransition } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import type { DashboardRange } from "@/lib/crm-types";

import { dashboardRanges } from "./dashboard-data";
export function DashboardHeader({ range, asOf }: { range: DashboardRange; asOf: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function select(value: DashboardRange) {
    const next = new URLSearchParams(params.toString());
    next.set("range", value);
    startTransition(() => router.push(`/dashboard?${next.toString()}`, { scroll: false }));
  }
  return (
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div>
        <p className="font-semibold text-slate-500 text-xs uppercase tracking-widest">Операционная сводка</p>
        <h1 className="mt-1 font-extrabold text-3xl text-slate-800 tracking-tight">Дашборд</h1>
        <p className="mt-2 text-slate-500 text-sm">
          Продажи, заявки и работа команды ·{" "}
          {new Intl.DateTimeFormat("ru-MD", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Chisinau",
          }).format(new Date(asOf))}
        </p>
      </div>
      <div>
        <div
          role="tablist"
          aria-label="Период аналитики"
          aria-busy={pending}
          className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1"
        >
          {dashboardRanges.map((option, index) => (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              role="tab"
              type="button"
              id={`range-${option.value}`}
              aria-controls="dashboard-panel"
              aria-selected={range === option.value}
              tabIndex={range === option.value ? 0 : -1}
              onClick={() => select(option.value)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === "ArrowRight") next = (index + 1) % dashboardRanges.length;
                else if (event.key === "ArrowLeft")
                  next = (index + dashboardRanges.length - 1) % dashboardRanges.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = dashboardRanges.length - 1;
                else return;
                event.preventDefault();
                refs.current[next]?.focus();
                select(dashboardRanges[next].value);
              }}
              className={`min-h-11 rounded-lg px-3 font-semibold text-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${range === option.value ? "bg-blue-50 text-slate-800 ring-1 ring-blue-500" : "text-slate-500"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span role="status" className="sr-only">
          {pending ? "Обновляем сводку" : "Сводка загружена"}
        </span>
      </div>
    </header>
  );
}
