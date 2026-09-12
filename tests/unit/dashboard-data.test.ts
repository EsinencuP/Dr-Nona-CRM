import { describe, expect, test } from "vitest";

import {
  aggregateDashboard,
  type DashboardOrder,
  dashboardDelta,
  getPreviousPeriodStats,
  normalizeRange,
  startDateForRange,
} from "../../src/app/(crm)/dashboard/_components/dashboard-data";
import { groupSources } from "../../src/app/(crm)/dashboard/_components/dashboard-format";
import type { DashboardRange } from "../../src/lib/crm-types";

const now = new Date("2026-09-12T12:00:00Z");
const DAY = 86400000;
function order(age: number, status = "DONE", type = "order"): DashboardOrder {
  return {
    createdAt: new Date(now.getTime() - age * DAY),
    status,
    type,
    utmSource: null,
    client: { region: "Кишинёв" },
    items: [{ productSlug: "solaris", quantity: 3, retailPriceAtPurchase: 100.1, distributorPriceAtPurchase: 60.05 }],
  };
}
function calculate(orders: DashboardOrder[], range: DashboardRange = "30d") {
  return aggregateDashboard({
    orders,
    range,
    now,
    newClients: 4,
    previousNewClients: 2,
    statuses: [
      { status: "NEW", count: 50 },
      { status: "PROCESSING", count: 15 },
      { status: "DELIVERY", count: 8 },
      { status: "CANCELLED", count: 7 },
    ],
    recentOrders: [],
    productNames: new Map([["solaris", "Solaris"]]),
  });
}
describe("dashboard period and cohort integrity", () => {
  test.each<[DashboardRange, number]>([
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
  ])("%s compares equal rolling windows with half-open boundaries", (range, days) => {
    expect(startDateForRange(range, now)?.getTime()).toBe(now.getTime() - days * DAY);
    const stats = calculate([order(0), order(days), order(days * 2), order(days * 2 + 1), order(-1)], range);
    expect(stats.kpis.total).toMatchObject({ value: 1, deltaAbs: 0 });
    expect(stats.timeline.reduce((sum, row) => sum + row.orders, 0)).toBe(1);
  });
  test("all-time has no fabricated previous comparison", () => {
    expect(startDateForRange("all", now)).toBeUndefined();
    const stats = calculate([order(1000), order(3)], "all");
    expect(stats.kpis.total).toEqual({ value: 2, delta: null, deltaAbs: null });
    expect(getPreviousPeriodStats([], undefined, now, 0)).toBeNull();
    expect(stats.timeline.reduce((sum, row) => sum + row.orders, 0)).toBe(2);
  });
  test("every reporting widget respects period; operational counts remain global", () => {
    const old = order(65);
    old.utmSource = "old-source";
    old.client.region = "Бельцы";
    const stats = calculate([old, order(1), order(2, "NEW"), order(3, "DONE", "consultation")]);
    expect(stats.kpis.total.value).toBe(3);
    expect(stats.kpis.done.value).toBe(2);
    expect(stats.kpis.revenue.value).toBe(300.3);
    expect(stats.kpis.unitsSold.value).toBe(3);
    expect(stats.kpis.profit.value).toBe(120.15);
    expect(stats.kpis.aov.value).toBe(300.3);
    expect(stats.kpis.conversionRate.value).toBeCloseTo(200 / 3);
    expect(stats.kpis.new).toBe(50);
    expect(stats.kpis.processing).toBe(15);
    expect(stats.regionOrders).toEqual([{ region: "Кишинёв", count: 3 }]);
    expect(stats.utmSources).toEqual([{ source: null, count: 3 }]);
    expect(stats.topProducts).toEqual([{ slug: "solaris", name: "Solaris", units: 3, revenue: 300.3 }]);
    expect(stats.peakHours.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    expect(stats.kpis.newClients).toEqual({ value: 4, delta: 100, deltaAbs: 2 });
  });
  test("unknown retail is excluded with disclosure and monetary deltas disabled", () => {
    const missing = order(2);
    missing.items[0].retailPriceAtPurchase = 0;
    const stats = calculate([order(1), missing, order(35)]);
    expect(stats.kpis.revenue).toEqual({ value: 300.3, delta: null, deltaAbs: null });
    expect(stats.kpis.unitsSold.value).toBe(6);
    expect(stats.quality.missingRetail).toBe(1);
    expect(stats.kpis.profit.value).toBe(120.15);
    expect(stats.timeline.reduce((sum, row) => sum + row.revenue, 0)).toBe(300.3);
  });
  test("missing purchase cost blocks profit comparison but retains known revenue", () => {
    const missing = order(1);
    missing.items[0].distributorPriceAtPurchase = 0;
    const stats = calculate([missing, order(35)]);
    expect(stats.quality.missingCost).toBe(1);
    expect(stats.kpis.profit.delta).toBeNull();
    expect(stats.kpis.revenue.delta).toBe(0);
    expect(stats.kpis.revenue.value).toBe(300.3);
  });
  test("cancellations are separate potential revenue, not completed sales", () => {
    const stats = calculate([order(1, "CANCELLED"), order(2)]);
    expect(stats.kpis.cancelled.value).toBe(1);
    expect(stats.lostRevenue).toBe(300.3);
    expect(stats.kpis.revenue.value).toBe(300.3);
    expect(stats.kpis.unitsSold.value).toBe(3);
  });
  test("Moldova day and hour grouping does not depend on server timezone", () => {
    const row = order(2);
    row.createdAt = new Date("2026-09-10T22:30:00Z");
    const stats = calculate([row]);
    expect(stats.timeline.find((bucket) => bucket.key === "2026-09-11")?.orders).toBe(1);
    expect(stats.peakHours[1].count).toBe(1);
  });
  test("zero-filled timeline, 24 hours, safe zero denominators and invalid ranges", () => {
    const stats = calculate([]);
    expect(stats.peakHours).toHaveLength(24);
    expect(stats.timeline.length).toBeGreaterThanOrEqual(30);
    expect(stats.kpis.revenue).toEqual({ value: 0, delta: null, deltaAbs: 0 });
    expect(stats.kpis.aov.value).toBe(0);
    expect(stats.kpis.conversionRate.value).toBe(0);
    for (const value of [null, undefined, ["7d"], "constructor", "wrong"]) expect(normalizeRange(value)).toBe("30d");
    expect(normalizeRange("90d")).toBe("90d");
    expect(dashboardDelta(5, 0)).toEqual({ value: 5, delta: null, deltaAbs: 5 });
    expect(JSON.stringify(stats)).not.toMatch(/NaN|Infinity/);
  });
  test("top 5 sorted by completed units and unknown slugs are preserved", () => {
    const orders = Array.from({ length: 7 }, (_, i) => {
      const row = order(i + 1);
      row.items[0].productSlug = `slug-${i}`;
      row.items[0].quantity = i + 1;
      return row;
    });
    expect(calculate(orders).topProducts.map((row) => row.units)).toEqual([7, 6, 5, 4, 3]);
  });
  test("donut and legend conserve every source, including null and Other name collisions", () => {
    const grouped = groupSources([
      { source: null, count: 9 },
      { source: "Другие", count: 8 },
      { source: "b", count: 7 },
      { source: "c", count: 6 },
      { source: "d", count: 5 },
      { source: "e", count: 4 },
    ]);
    expect(grouped).toHaveLength(5);
    expect(grouped.reduce((sum, row) => sum + row.count, 0)).toBe(39);
    expect(grouped[0].label).toBe("Прямой переход");
    expect(grouped[4].count).toBe(9);
    expect(new Set(grouped.map((row) => row.key)).size).toBe(5);
  });
});
