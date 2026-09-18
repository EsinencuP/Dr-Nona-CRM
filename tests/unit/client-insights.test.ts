import { describe, expect, test } from "vitest";

import { calculateClientInsights } from "../../server/clients/client-insights";

const order = (
  status: "NEW" | "PROCESSING" | "DELIVERY" | "DONE" | "CANCELLED",
  slug: string,
  quantity: number,
  preferredCallTime: string | null = null,
) => ({
  status,
  type: "order" as const,
  preferredCallTime,
  createdAt: new Date("2030-01-01T10:00:00Z"),
  items: [{ productSlug: slug, quantity, priceAtPurchase: status === "DONE" ? 10 : 0 }],
});

describe("client insights", () => {
  test("uses only completed requests for repeat and product calculations", () => {
    const insight = calculateClientInsights([
      order("DONE", "a", 2, "После 18:00"),
      order("DONE", "b", 1, "После 18:00"),
      order("DONE", "a", 1, "До 12:00"),
      order("CANCELLED", "b", 99, "До 12:00"),
    ]);
    expect(insight.repeatClient).toBe(true);
    expect(insight.completedCount).toBe(3);
    expect(insight.completedValue).toBe(40);
    expect(insight.incompletePriceItems).toBe(0);
    expect(insight.preferredProducts).toEqual([
      { slug: "a", units: 3 },
      { slug: "b", units: 1 },
    ]);
    expect(insight.preferredContact).toEqual({ value: "После 18:00", count: 2 });
  });

  test("keeps an empty profile factual", () => {
    expect(calculateClientInsights([])).toEqual({
      completedCount: 0,
      repeatClient: false,
      completedValue: 0,
      incompletePriceItems: 0,
      preferredProducts: [],
      preferredContact: null,
    });
  });
});
