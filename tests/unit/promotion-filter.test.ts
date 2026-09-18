import { describe, expect, test } from "vitest";

import type { ResultsData } from "../../server/analytics/results-calculations";
import {
  filterPromotionRecommendations,
  promotionCategories,
} from "../../src/app/(crm)/results/components/promotion-filter";

function sku(slug: string, name: string, category: string): ResultsData["skus"][number] {
  const comparison = { value: 0, previous: 0, delta: 0, percent: null };
  return {
    slug,
    name,
    sku: slug,
    category,
    retailPrice: 0,
    distributorPrice: 0,
    units: 0,
    trend: comparison,
    monthlyTrend: comparison,
    velocity: 0,
    growth: 0,
    months: [0, 0, 0],
    reorder: 0,
    margin: null,
  };
}

const skus: ResultsData["skus"] = [sku("cream", "Крем", "Кремы"), sku("tea", "Чай", "Напитки")];
const recommendations: ResultsData["recommendations"] = {
  masterclass: [
    { slug: "cream", name: "Крем", margin: 10, velocity: 1 },
    { slug: "tea", name: "Чай", margin: 8, velocity: 2 },
  ],
  volume: [
    { slug: "cream", name: "Крем", units: 5 },
    { slug: "tea", name: "Чай", units: 4 },
  ],
  seasonal: [
    {
      id: "season",
      label: "Сезон",
      target: "2026-10-01T00:00:00.000Z",
      prepareFrom: "2026-08-17T00:00:00.000Z",
      prepareTo: "2026-09-01T00:00:00.000Z",
      due: true,
      productNames: ["Крем", "Чай"],
    },
  ],
};

describe("promotion category presentation", () => {
  test("derives only verified catalogue categories", () => {
    expect(promotionCategories(skus)).toEqual(["Кремы", "Напитки"]);
  });

  test("filters every recommendation group without changing the source", () => {
    const filtered = filterPromotionRecommendations(recommendations, skus, "Кремы");
    expect(filtered.masterclass.map((item) => item.slug)).toEqual(["cream"]);
    expect(filtered.volume.map((item) => item.slug)).toEqual(["cream"]);
    expect(filtered.seasonal[0]?.productNames).toEqual(["Крем"]);
    expect(recommendations.seasonal[0]?.productNames).toEqual(["Крем", "Чай"]);
  });

  test("returns explicit empty groups for an unmatched category", () => {
    expect(filterPromotionRecommendations(recommendations, skus, "Парфюмерия")).toEqual({
      masterclass: [],
      volume: [],
      seasonal: [],
    });
  });
});
