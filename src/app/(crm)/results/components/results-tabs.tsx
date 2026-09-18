"use client";

import { useRef } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

import { buildResultsViewHref, RESULTS_VIEW_LABELS, RESULTS_VIEWS, type ResultsView } from "../results-view";

export function ResultsTabs({ view }: { view: ResultsView }) {
  const params = useSearchParams();
  const tabs = useRef<Array<HTMLAnchorElement | null>>([]);

  function move(event: React.KeyboardEvent<HTMLAnchorElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % RESULTS_VIEWS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + RESULTS_VIEWS.length) % RESULTS_VIEWS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = RESULTS_VIEWS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs.current[nextIndex];
    nextTab?.focus();
    nextTab?.click();
  }

  return (
    <div className="mb-5 min-w-0">
      <div
        aria-label="Разделы результатов"
        role="tablist"
        className="grid w-full min-w-0 grid-cols-3 gap-1 rounded-xl border bg-white p-1 sm:inline-grid sm:w-auto"
      >
        {RESULTS_VIEWS.map((item, index) => {
          const selected = view === item;
          return (
            <Link
              key={item}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              id={`results-tab-${item}`}
              href={buildResultsViewHref(item, params.toString())}
              role="tab"
              aria-selected={selected}
              aria-controls={`results-panel-${item}`}
              tabIndex={selected ? 0 : -1}
              scroll={false}
              prefetch={false}
              onKeyDown={(event) => move(event, index)}
              className={cn(
                "flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-1 py-2 font-semibold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4 sm:text-sm",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {RESULTS_VIEW_LABELS[item]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
