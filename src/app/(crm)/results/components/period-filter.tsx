"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";

import type { ResultsPeriod } from "../../../../../server/analytics/results-calculations";
import { buildResultsPeriodHref } from "../results-view";

const periods = [
  { id: "1m", label: "30 дней" },
  { id: "3m", label: "90 дней" },
  { id: "6m", label: "180 дней" },
  { id: "1y", label: "365 дней" },
] as const;

export function PeriodFilter({ period }: { period: ResultsPeriod }) {
  const params = useSearchParams();
  return (
    <nav aria-label="Период результатов" className="mb-5 flex flex-wrap gap-2">
      {periods.map(({ id, label }) => {
        return (
          <Link
            key={id}
            href={buildResultsPeriodHref(id, params.toString())}
            scroll={false}
            aria-current={period === id ? "page" : undefined}
            className={buttonVariants({ variant: period === id ? "default" : "outline", className: "min-h-11" })}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
