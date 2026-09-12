import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  calculateResults,
  compare,
  forecastUnits,
  getPeriodRanges,
  parseResultsPeriod,
  type ResultsPeriod,
  type SalesOrder,
} from "../../server/analytics/results-calculations";

const mocks = vi.hoisted(() => ({ access: vi.fn(), findOrders: vi.fn(), findPrices: vi.fn(), transaction: vi.fn() }));
vi.mock("../../src/server/crm-auth", () => ({ requireCrmAccess: mocks.access }));
vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    order: { findMany: mocks.findOrders },
    productCatalog: { findMany: mocks.findPrices },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../../src/lib/products", () => ({
  products: [{ slug: "a", name: "Товар А", sku: "001", category: "Кремы" }],
}));

import { getResultsData } from "../../server/analytics/results-service";

const now = new Date("2026-09-12T10:00:00.000Z");
const day = 86_400_000;
const catalog = [
  { slug: "a", name: "Товар А", sku: "001", category: "Кремы", retailPrice: 200, distributorPrice: 130 },
  { slug: "b", name: "Товар Б", sku: "002", category: "Кремы", retailPrice: 500, distributorPrice: 250 },
];
function order(age: number, quantity = 1, overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    createdAt: new Date(now.getTime() - age * day),
    status: "DONE",
    type: "order",
    client: { region: "Кишинёв" },
    items: [{ productSlug: "a", quantity, retailPriceAtPurchase: 100.1, distributorPriceAtPurchase: 60.05 }],
    ...overrides,
  };
}

describe("results calculations", () => {
  test.each<[ResultsPeriod, number]>([
    ["1m", 30],
    ["3m", 90],
    ["6m", 180],
    ["1y", 365],
  ])("%s uses equal rolling windows, including across leap years", (period, days) => {
    const ranges = getPeriodRanges(period, new Date("2024-03-01T10:00:00Z"));
    expect(ranges.end.getTime() - ranges.start.getTime()).toBe(days * day);
    expect(ranges.start.getTime() - ranges.previousStart.getTime()).toBe(days * day);
  });

  test("half-open windows count the start once, exclude now and out-of-range rows", () => {
    const result = calculateResults(
      [order(0), order(30, 2), order(60, 3), order(61, 4), order(-1)],
      catalog,
      "1m",
      now,
    );
    expect(result.current.units).toBe(2);
    expect(result.previous.units).toBe(3);
    expect(result.skus[0]?.velocity).toBe(2 * 0.5 + 3 * 0.3 + 4 * 0.2);
  });

  test("revenue, profit, average and differences use immutable purchase prices and bani", () => {
    const result = calculateResults([order(2, 3), order(35, 1)], catalog, "1m", now);
    expect(result.current.revenue).toBe(300.3);
    expect(result.current.profit).toBe(120.15);
    expect(result.current.average).toBe(300.3);
    expect(result.kpis.units).toEqual({ value: 3, previous: 1, delta: 2, percent: 200 });
  });

  test("ignores cancelled, pending and non-order applications", () => {
    const result = calculateResults(
      [
        order(1, 2),
        order(2, 10, { status: "CANCELLED" }),
        order(2, 20, { status: "NEW" }),
        order(2, 40, { type: "consultation" }),
        order(2, 80, { type: "masterclass" }),
      ],
      catalog,
      "1m",
      now,
    );
    expect(result.current.units).toBe(2);
    expect(result.current.orders).toBe(1);
  });

  test("missing retail does not fabricate zero revenue or profit, units remain", () => {
    const missing = order(2, 3);
    missing.items[0].retailPriceAtPurchase = 0;
    const result = calculateResults([missing, order(3)], catalog, "1m", now);
    expect(result.current).toMatchObject({ units: 4, revenue: null, profit: null, average: null, missingRetail: 1 });
  });

  test("missing cost still allows known revenue, blocks profit only", () => {
    const missing = order(2);
    missing.items[0].distributorPriceAtPurchase = 0;
    expect(calculateResults([missing], catalog, "1m", now).current).toMatchObject({
      revenue: 100.1,
      profit: null,
      missingCost: 1,
    });
  });

  test("empty and corrupt line items are visibly incomplete", () => {
    const result = calculateResults([order(1, -3), order(2, 1, { items: [] })], catalog, "1m", now);
    expect(result.current).toMatchObject({ units: 0, revenue: null, profit: null, missingRetail: 2 });
  });

  test("negative profit remains negative and comparison is safe across zero", () => {
    const loss = order(1, 2);
    loss.items[0].distributorPriceAtPurchase = 120.1;
    expect(calculateResults([loss], catalog, "1m", now).current.profit).toBe(-40);
    expect(compare(20, -10).percent).toBe(300);
    expect(compare(20, 0)).toEqual({ value: 20, previous: 0, delta: 20, percent: null });
    expect(compare(null, 0).delta).toBeNull();
  });

  test("weighted forecast projects individual months and rounds reorder buffer upward", () => {
    expect(forecastUnits(30, 20, 10)).toEqual({ velocity: 23, growth: 0.5, months: [35, 52, 78], reorder: 41 });
    expect(forecastUnits(20, 20, 20)).toEqual({ velocity: 20, growth: 0, months: [20, 20, 20], reorder: 23 });
    expect(forecastUnits(1000, 1, 1).growth).toBe(0.5);
    expect(forecastUnits(0, 100, 100).growth).toBe(-0.5);
    expect(forecastUnits(10, 0, 0).growth).toBe(0);
    expect(forecastUnits(0, 0, 0).reorder).toBe(0);
  });

  test("forecast uses the same recent 90 days regardless of selected reporting period", () => {
    const rows = [order(2, 30), order(35, 20), order(65, 10), order(200, 999)];
    expect(calculateResults(rows, catalog, "1m", now).skus[0]?.months).toEqual(
      calculateResults(rows, catalog, "1y", now).skus[0]?.months,
    );
  });

  test("region totals conserve units, including unknown regions and catalogue slugs", () => {
    const unknown = order(2, 4, { client: { region: "Unknown" } });
    unknown.items[0].productSlug = "retired-product";
    const result = calculateResults([order(1, 3), unknown], catalog, "1m", now);
    expect(result.regions).toHaveLength(37);
    expect(result.regions.reduce((sum, region) => sum + region.units, 0)).toBe(result.current.units);
    expect(result.skus.find((sku) => sku.slug === "retired-product")?.units).toBe(4);
    expect(result.regions.find((region) => region.name === "Регион не распознан")?.units).toBe(4);
  });

  test("masterclasses use known positive margin and low velocity; volume uses actual sales", () => {
    const result = calculateResults([order(2, 30)], catalog, "1m", now);
    expect(result.recommendations.masterclass.map((sku) => sku.slug)).toEqual(["b"]);
    expect(result.recommendations.volume.map((sku) => sku.slug)).toEqual(["a"]);
    expect(
      calculateResults(
        [],
        catalog.map((sku) => ({ ...sku, distributorPrice: 0 })),
        "1m",
        now,
      ).recommendations.masterclass,
    ).toEqual([]);
  });

  test("empty data and invalid URL filters are deterministic and safe", () => {
    const result = calculateResults([], catalog, "1m", now);
    expect(result.current).toMatchObject({ orders: 0, units: 0, average: 0, revenue: 0 });
    expect(result.regions).toHaveLength(36);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
    for (const value of [undefined, ["1y"], "constructor", "__proto__", "bad"])
      expect(parseResultsPeriod(value)).toBe("1m");
    expect(parseResultsPeriod("6m")).toBe("6m");
  });
});

describe("results service boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.access.mockResolvedValue(undefined);
    mocks.transaction.mockResolvedValue([[], []]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("authenticates before selecting minimal data in one repeatable-read transaction", async () => {
    await getResultsData("1m");
    expect(mocks.access).toHaveBeenCalledOnce();
    expect(mocks.findOrders).toHaveBeenCalledWith({
      where: { status: "DONE", type: "order", createdAt: { gte: new Date(now.getTime() - 90 * day), lt: now } },
      select: {
        createdAt: true,
        status: true,
        type: true,
        client: { select: { region: true } },
        items: {
          select: { productSlug: true, quantity: true, retailPriceAtPurchase: true, distributorPriceAtPurchase: true },
        },
      },
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Array), { isolationLevel: "RepeatableRead" });
  });

  test("rejects unauthorized access without querying the database", async () => {
    mocks.access.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(getResultsData("1y")).rejects.toThrow("Unauthorized");
    expect(mocks.findOrders).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("database failure is not represented as zero sales", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("Unavailable"));
    await expect(getResultsData("1m")).rejects.toThrow("Unavailable");
  });
});
