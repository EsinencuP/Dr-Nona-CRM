import { formatDistanceStrict } from "date-fns";
import { ru } from "date-fns/locale";
export function dashboardMoney(value: number) {
  return `${new Intl.NumberFormat("ru-MD", { maximumFractionDigits: 0 }).format(value)} MDL`;
}
export function dashboardNumber(value: number) {
  return new Intl.NumberFormat("ru-MD", { maximumFractionDigits: 1 }).format(value);
}
export function formatCompactNumber(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${dashboardNumber(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${dashboardNumber(value / 1_000)}к`;
  return dashboardNumber(value);
}
export function formatRelativeTime(date: string, asOf: string) {
  return formatDistanceStrict(new Date(date), new Date(asOf), { locale: ru, addSuffix: true });
}
export function deltaBadgeClass(delta: number | null) {
  if (delta !== null && delta > 0) return "bg-emerald-50 text-emerald-700";
  if (delta !== null && delta < 0) return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-500";
}
export function deltaArrow(delta: number | null) {
  if (delta !== null && delta > 0) return "▲";
  if (delta !== null && delta < 0) return "▼";
  return "—";
}
export function groupSources(sources: Array<{ source: string | null; count: number }>) {
  const rows = sources.map((row) => ({
    ...row,
    label: row.source ?? "Прямой переход",
    key: row.source === null ? "direct" : `source:${row.source}`,
  }));
  if (rows.length <= 5) return rows;
  return [
    ...rows.slice(0, 4),
    {
      source: "other",
      key: "group:other",
      label: "Другие",
      count: rows.slice(4).reduce((sum, row) => sum + row.count, 0),
    },
  ];
}
