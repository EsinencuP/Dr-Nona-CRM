import type { ResultsData } from "../../../../../server/analytics/results-calculations";

export function promotionCategories(skus: ResultsData["skus"]) {
  return [...new Set(skus.map((sku) => sku.category).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "ru"),
  );
}

export function filterPromotionRecommendations(
  recommendations: ResultsData["recommendations"],
  skus: ResultsData["skus"],
  category: string,
) {
  const categoryBySlug = new Map(skus.map((sku) => [sku.slug, sku.category]));
  const categoryByName = new Map(skus.map((sku) => [sku.name, sku.category]));
  return {
    masterclass: recommendations.masterclass.filter((sku) => !category || categoryBySlug.get(sku.slug) === category),
    volume: recommendations.volume.filter((sku) => !category || categoryBySlug.get(sku.slug) === category),
    seasonal: recommendations.seasonal
      .map((advice) => ({
        ...advice,
        productNames: advice.productNames.filter((name) => !category || categoryByName.get(name) === category),
      }))
      .filter((advice) => advice.productNames.length > 0),
  };
}
