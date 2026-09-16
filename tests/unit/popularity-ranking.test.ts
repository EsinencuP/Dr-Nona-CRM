import { describe, expect, test } from "vitest";

import { createPopularityCandidate } from "../../server/popularity/ranking";

const now = new Date("2026-09-16T12:00:00.000Z");
const published = new Set(["cream", "lotion", "salt"]);

function order(index: number, overrides: Partial<Parameters<typeof createPopularityCandidate>[0][number]> = {}) {
  return {
    id: `real-${index}`,
    clientId: `client-${index % 6}`,
    createdAt: new Date("2026-09-15T12:00:00.000Z"),
    type: "order",
    status: "DONE",
    items: [{ productSlug: "cream" }],
    ...overrides,
  };
}

describe("90-day CRM popularity candidate", () => {
  test("counts distinct completed orders per product, not units or repeated lines", () => {
    const orders = Array.from({ length: 12 }, (_, index) =>
      order(index, {
        items:
          index < 7
            ? [{ productSlug: "cream" }, { productSlug: "cream" }, { productSlug: "lotion" }]
            : [{ productSlug: "lotion" }],
      }),
    );
    const result = createPopularityCandidate(orders, published, now);
    expect(result.status).toBe("ready");
    expect(result.eligibleOrders).toBe(12);
    expect(result.distinctClients).toBe(6);
    expect(result.counts).toEqual([
      { slug: "lotion", orderCount: 12 },
      { slug: "cream", orderCount: 7 },
    ]);
    expect(JSON.stringify(result)).not.toContain("client-0");
  });

  test("excludes demo, cancelled, consultation, stale and future orders", () => {
    const orders = [
      order(0),
      order(1, { id: "demo-analytics-order-1" }),
      order(2, { status: "CANCELLED" }),
      order(3, { type: "consultation" }),
      order(4, { createdAt: new Date("2026-06-17T11:59:59.999Z") }),
      order(5, { createdAt: now }),
    ];
    const result = createPopularityCandidate(orders, published, now);
    expect(result.eligibleOrders).toBe(1);
    expect(result.status).toBe("insufficient");
    expect(result.counts).toEqual([{ slug: "cream", orderCount: 1 }]);
  });

  test("requires both order and distinct-client threshold", () => {
    const sameClient = Array.from({ length: 11 }, (_, index) => order(index, { clientId: "one" }));
    expect(createPopularityCandidate(sameClient, published, now).status).toBe("insufficient");
    expect(createPopularityCandidate([], published, now).status).toBe("insufficient");
  });

  test("quarantines unknown product slugs and never publishes a partial ranking", () => {
    const orders = Array.from({ length: 12 }, (_, index) => order(index));
    orders[0] = order(0, { items: [{ productSlug: "removed-product" }, { productSlug: "cream" }] });
    const result = createPopularityCandidate(orders, published, now);
    expect(result.status).toBe("insufficient");
    expect(result.quarantinedSlugs).toEqual(["removed-product"]);
    expect(result.counts).toEqual([{ slug: "cream", orderCount: 12 }]);
  });
});
