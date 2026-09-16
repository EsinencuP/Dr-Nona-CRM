import { MOLDOVA_REGIONS } from "../../shared/constants/moldova-regions";
import { getPeriodRanges, type ResultsPeriod } from "./results-calculations";

const MINUTE = 60_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Chisinau" });

export type OperationalOrder = {
  createdAt: Date;
  status: string;
  firstActionAt: Date | null;
  submittedRegion: string;
};

function summarize(orders: OperationalOrder[], now: Date) {
  const completed = orders.filter((order) => order.status === "DONE").length;
  const firstActions = orders
    .filter((order) => order.firstActionAt && order.firstActionAt >= order.createdAt && order.firstActionAt <= now)
    .map((order) => ((order.firstActionAt as Date).getTime() - order.createdAt.getTime()) / MINUTE);
  return {
    applications: orders.length,
    completed,
    completionRate: orders.length ? (completed / orders.length) * 100 : null,
    measuredFirstActions: firstActions.length,
    missingFirstActions: orders.length - firstActions.length,
    averageFirstActionMinutes: firstActions.length
      ? firstActions.reduce((sum, minutes) => sum + minutes, 0) / firstActions.length
      : null,
  };
}

export function calculateOperationalResults(orders: OperationalOrder[], period: ResultsPeriod, now: Date) {
  const { start, previousStart, end } = getPeriodRanges(period, now);
  const eligible = orders.filter((order) => order.createdAt >= previousStart && order.createdAt < end);
  const currentOrders = eligible.filter((order) => order.createdAt >= start);
  const previousOrders = eligible.filter((order) => order.createdAt < start);
  const weekdays = WEEKDAYS.map((day) => ({ day, applications: 0, completed: 0 }));
  const regions = new Map<string, OperationalOrder[]>(MOLDOVA_REGIONS.map((region) => [region, []]));

  for (const order of currentOrders) {
    const day = weekdayFormatter.format(order.createdAt);
    const weekday = weekdays.find((item) => item.day === day);
    if (weekday) {
      weekday.applications += 1;
      if (order.status === "DONE") weekday.completed += 1;
    }
    const region = regions.has(order.submittedRegion) ? order.submittedRegion : "Регион не распознан";
    const group = regions.get(region);
    if (group) group.push(order);
    else regions.set(region, [order]);
  }

  return {
    current: summarize(currentOrders, now),
    previous: summarize(previousOrders, now),
    weekdays,
    regions: [...regions]
      .map(([name, rows]) => ({ name, ...summarize(rows, now) }))
      .filter((region) => region.applications > 0)
      .sort((left, right) => right.applications - left.applications || left.name.localeCompare(right.name, "ru")),
  };
}

export type OperationalResults = ReturnType<typeof calculateOperationalResults>;
