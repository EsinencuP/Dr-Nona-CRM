import { expect, test } from "vitest";

import { seasonalAdvice } from "../../server/analytics/results-calculations";

const catalog = [
  { slug: "gonseen", name: "Gonseen Tea", sku: "001", category: "Напитки", retailPrice: 0, distributorPrice: 0 },
];
test("seasonal preparations are 30–45 days before the next season and only use existing products", () => {
  const advice = seasonalAdvice(catalog, new Date("2026-09-12T12:00:00Z"));
  expect(advice).toHaveLength(1);
  expect(advice[0]).toMatchObject({
    id: "autumn",
    target: "2026-10-01T00:00:00.000Z",
    prepareFrom: "2026-08-17T00:00:00.000Z",
    prepareTo: "2026-09-01T00:00:00.000Z",
    due: true,
    productNames: ["Gonseen Tea"],
  });
  expect(seasonalAdvice(catalog, new Date("2026-12-01T12:00:00Z"))[0]?.target).toBe("2027-10-01T00:00:00.000Z");
  expect(seasonalAdvice([], new Date())).toEqual([]);
});
