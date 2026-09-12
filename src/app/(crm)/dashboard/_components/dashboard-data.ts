import type { DashboardRange, DashboardStats, MetricWithDelta } from "../../../../lib/crm-types";

const DAY = 86_400_000;
export const dashboardRanges = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "Месяц" },
  { value: "90d", label: "3 месяца" },
  { value: "all", label: "Всё время" },
] as const;
export function normalizeRange(value: unknown): DashboardRange {
  return dashboardRanges.find((range) => range.value === value)?.value ?? "30d";
}
export function startDateForRange(range: DashboardRange, now: Date) {
  if (range === "all") return undefined;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  return new Date(now.getTime() - days * DAY);
}

export type DashboardOrder = {
  createdAt: Date;
  status: string;
  type: string;
  utmSource: string | null;
  client: { region: string };
  items: Array<{
    productSlug: string;
    quantity: number;
    retailPriceAtPurchase: number;
    distributorPriceAtPurchase: number;
  }>;
};
export type PeriodTotals = ReturnType<typeof periodTotals>;
function periodTotals(orders: DashboardOrder[], newClients: number) {
  let revenue = 0;
  let profit = 0;
  let unitsSold = 0;
  let missingRetail = 0;
  let missingCost = 0;
  let salesOrders = 0;
  let lostRevenue = 0;
  let cancelledMissingRetail = 0;
  for (const order of orders) {
    if (order.type !== "order" || (order.status !== "DONE" && order.status !== "CANCELLED")) continue;
    if (order.status === "DONE") salesOrders += 1;
    let retailMissing = order.items.length === 0;
    let costMissing = order.items.length === 0;
    for (const item of order.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
        retailMissing = true;
        costMissing = true;
        continue;
      }
      const retailKnown = Number.isFinite(item.retailPriceAtPurchase) && item.retailPriceAtPurchase > 0;
      const costKnown = Number.isFinite(item.distributorPriceAtPurchase) && item.distributorPriceAtPurchase > 0;
      if (!retailKnown) retailMissing = true;
      if (!costKnown) costMissing = true;
      const retail = Math.round(item.retailPriceAtPurchase * 100) * item.quantity;
      const cost = Math.round(item.distributorPriceAtPurchase * 100) * item.quantity;
      if (order.status === "CANCELLED") {
        if (retailKnown) lostRevenue += retail;
        continue;
      }
      unitsSold += item.quantity;
      if (retailKnown) revenue += retail;
      if (retailKnown && costKnown) profit += retail - cost;
    }
    if (order.status === "DONE") {
      if (retailMissing) missingRetail += 1;
      if (costMissing) missingCost += 1;
    } else if (retailMissing) cancelledMissingRetail += 1;
  }
  const done = orders.filter((order) => order.status === "DONE").length;
  return {
    total: orders.length,
    done,
    cancelled: orders.filter((order) => order.status === "CANCELLED").length,
    revenue: revenue / 100,
    profit: profit / 100,
    unitsSold,
    aov: revenue / 100 / Math.max(salesOrders, 1),
    newClients,
    conversionRate: orders.length ? (done / orders.length) * 100 : 0,
    missingRetail,
    missingCost,
    lostRevenue: lostRevenue / 100,
    cancelledMissingRetail,
  };
}

export function getPreviousPeriodStats(
  orders: DashboardOrder[],
  start: Date | undefined,
  now: Date,
  newClients: number,
): PeriodTotals | null {
  if (!start) return null;
  const previousStart = 2 * start.getTime() - now.getTime();
  return periodTotals(
    orders.filter((order) => order.createdAt.getTime() >= previousStart && order.createdAt < start),
    newClients,
  );
}

export function dashboardDelta(value: number, previous: number | null, incomplete = false): MetricWithDelta {
  if (previous === null || incomplete) return { value, delta: null, deltaAbs: null };
  return {
    value,
    deltaAbs: value - previous,
    delta: previous === 0 ? null : ((value - previous) / Math.abs(previous)) * 100,
  };
}

const localDate = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Chisinau",
});
const localHour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Chisinau" });
function dayKey(date: Date) {
  return localDate.format(date);
}

export function aggregateDashboard({
  orders,
  range,
  now,
  newClients,
  previousNewClients,
  statuses,
  recentOrders,
  productNames,
}: {
  orders: DashboardOrder[];
  range: DashboardRange;
  now: Date;
  newClients: number;
  previousNewClients: number;
  statuses: Array<{ status: string; count: number }>;
  recentOrders: DashboardStats["recentOrders"];
  productNames: ReadonlyMap<string, string>;
}): DashboardStats {
  const start = startDateForRange(range, now);
  const current = orders.filter((order) => order.createdAt < now && (!start || order.createdAt >= start));
  const totals = periodTotals(current, newClients);
  const previous = getPreviousPeriodStats(orders, start, now, previousNewClients);
  const monetaryIncomplete = totals.missingRetail > 0 || (previous?.missingRetail ?? 0) > 0;
  const marginIncomplete = monetaryIncomplete || totals.missingCost > 0 || (previous?.missingCost ?? 0) > 0;
  const statusMap = new Map(statuses.map((row) => [row.status, row.count]));
  const timeline = new Map<string, { key: string; label: string; orders: number; revenue: number }>();
  function addBucket(key: string) {
    if (!timeline.has(key)) {
      const date = new Date(`${key.length === 7 ? `${key}-01` : key}T12:00:00Z`);
      timeline.set(key, {
        key,
        label: new Intl.DateTimeFormat("ru-MD", {
          day: range === "all" ? undefined : "numeric",
          month: "short",
          year: range === "all" ? "2-digit" : undefined,
          timeZone: "Europe/Chisinau",
        }).format(date),
        orders: 0,
        revenue: 0,
      });
    }
  }
  if (start) {
    const cursor = new Date(`${dayKey(start)}T12:00:00Z`);
    const last = dayKey(now);
    while (cursor.toISOString().slice(0, 10) <= last) {
      addBucket(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else if (current.length) {
    const first = new Date(Math.min(...current.map((order) => order.createdAt.getTime())));
    const cursor = new Date(`${dayKey(first).slice(0, 7)}-01T12:00:00Z`);
    const last = dayKey(now).slice(0, 7);
    while (cursor.toISOString().slice(0, 7) <= last) {
      addBucket(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const regions = new Map<string, number>();
  const sources = new Map<string | null, number>();
  const topProducts = new Map<string, { slug: string; name: string; units: number; revenue: number }>();
  const peakHours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const order of current) {
    const key = dayKey(order.createdAt).slice(0, range === "all" ? 7 : 10);
    addBucket(key);
    const bucket = timeline.get(key);
    if (bucket) bucket.orders += 1;
    const region = order.client.region.trim() || "Регион не указан";
    regions.set(region, (regions.get(region) ?? 0) + 1);
    const source = order.utmSource?.trim() || null;
    sources.set(source, (sources.get(source) ?? 0) + 1);
    const hour = peakHours[Number(localHour.format(order.createdAt))];
    if (hour) hour.count += 1;
    if (order.status !== "DONE" || order.type !== "order") continue;
    for (const item of order.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue;
      const product = topProducts.get(item.productSlug) ?? {
        slug: item.productSlug,
        name: productNames.get(item.productSlug) ?? item.productSlug,
        units: 0,
        revenue: 0,
      };
      const revenue =
        Number.isFinite(item.retailPriceAtPurchase) && item.retailPriceAtPurchase > 0
          ? Math.round(item.retailPriceAtPurchase * 100) * item.quantity
          : 0;
      product.units += item.quantity;
      product.revenue += revenue;
      if (bucket) bucket.revenue += revenue;
      topProducts.set(item.productSlug, product);
    }
  }
  return {
    range,
    asOf: now.toISOString(),
    start: start?.toISOString() ?? null,
    previousStart: start ? new Date(2 * start.getTime() - now.getTime()).toISOString() : null,
    kpis: {
      total: dashboardDelta(totals.total, previous?.total ?? null),
      done: dashboardDelta(totals.done, previous?.done ?? null),
      cancelled: dashboardDelta(totals.cancelled, previous?.cancelled ?? null),
      revenue: dashboardDelta(totals.revenue, previous?.revenue ?? null, monetaryIncomplete),
      profit: dashboardDelta(totals.profit, previous?.profit ?? null, marginIncomplete),
      unitsSold: dashboardDelta(totals.unitsSold, previous?.unitsSold ?? null),
      aov: dashboardDelta(totals.aov, previous?.aov ?? null, monetaryIncomplete),
      newClients: dashboardDelta(totals.newClients, previous?.newClients ?? null),
      conversionRate: dashboardDelta(totals.conversionRate, previous?.conversionRate ?? null),
      new: statusMap.get("NEW") ?? 0,
      processing: statusMap.get("PROCESSING") ?? 0,
      delivery: statusMap.get("DELIVERY") ?? 0,
      cancelledNow: statusMap.get("CANCELLED") ?? 0,
    },
    timeline: [...timeline.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((bucket) => ({ ...bucket, revenue: bucket.revenue / 100 })),
    regionOrders: [...regions]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region, "ru")),
    utmSources: [...sources]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || (a.source ?? "").localeCompare(b.source ?? "")),
    topProducts: [...topProducts.values()]
      .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((product) => ({ ...product, revenue: product.revenue / 100 })),
    peakHours,
    recentOrders,
    quality: {
      missingRetail: totals.missingRetail,
      missingCost: totals.missingCost,
      previousMissingRetail: previous?.missingRetail ?? 0,
      previousMissingCost: previous?.missingCost ?? 0,
      cancelledMissingRetail: totals.cancelledMissingRetail,
    },
    lostRevenue: totals.lostRevenue,
  };
}
