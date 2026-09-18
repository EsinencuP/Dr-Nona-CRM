export type ClientInsightOrder = {
  status: "NEW" | "PROCESSING" | "DELIVERY" | "DONE" | "CANCELLED";
  type: "order" | "consultation" | "masterclass";
  preferredCallTime: string | null;
  createdAt: Date;
  items: Array<{ productSlug: string; quantity: number; priceAtPurchase?: number }>;
};

export function calculateClientInsights(orders: readonly ClientInsightOrder[]) {
  const completed = orders.filter((order) => order.status === "DONE");
  const productUnits = new Map<string, number>();
  let completedValue = 0;
  let incompletePriceItems = 0;
  for (const order of completed) {
    for (const item of order.items) {
      productUnits.set(item.productSlug, (productUnits.get(item.productSlug) ?? 0) + item.quantity);
      if ((item.priceAtPurchase ?? 0) > 0) completedValue += (item.priceAtPurchase ?? 0) * item.quantity;
      else incompletePriceItems += 1;
    }
  }
  const preferredProducts = [...productUnits]
    .sort(
      ([leftSlug, leftUnits], [rightSlug, rightUnits]) => rightUnits - leftUnits || leftSlug.localeCompare(rightSlug),
    )
    .slice(0, 3)
    .map(([slug, units]) => ({ slug, units }));

  const callTimes = new Map<string, { count: number; lastUsedAt: number }>();
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    const value = order.preferredCallTime?.trim();
    if (!value) continue;
    const current = callTimes.get(value) ?? { count: 0, lastUsedAt: 0 };
    callTimes.set(value, {
      count: current.count + 1,
      lastUsedAt: Math.max(current.lastUsedAt, order.createdAt.getTime()),
    });
  }
  const preferredContact =
    [...callTimes]
      .sort(
        ([leftValue, left], [rightValue, right]) =>
          right.count - left.count || right.lastUsedAt - left.lastUsedAt || leftValue.localeCompare(rightValue),
      )
      .map(([value, evidence]) => ({ value, count: evidence.count }))[0] ?? null;

  return {
    completedCount: completed.length,
    repeatClient: completed.length >= 3,
    completedValue,
    incompletePriceItems,
    preferredProducts,
    preferredContact,
  };
}
