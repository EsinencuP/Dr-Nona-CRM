import type { ResultsPeriod } from "../../../../server/analytics/results-calculations";

export const RESULTS_VIEWS = ["sales", "forecast", "promotion"] as const;

export type ResultsView = (typeof RESULTS_VIEWS)[number];

export const RESULTS_VIEW_LABELS: Record<ResultsView, string> = {
  sales: "Продажи",
  forecast: "Прогноз",
  promotion: "Продвижение",
};

export function parseResultsView(value: string | string[] | undefined): ResultsView {
  if (typeof value !== "string") return "sales";
  return (RESULTS_VIEWS as readonly string[]).includes(value) ? (value as ResultsView) : "sales";
}

export function buildResultsViewHref(view: ResultsView, query: string) {
  const params = new URLSearchParams(query);
  params.set("view", view);
  return `/results?${params.toString()}`;
}

export function buildResultsPeriodHref(period: ResultsPeriod, query: string) {
  const params = new URLSearchParams(query);
  params.set("period", period);
  return `/results?${params.toString()}`;
}
