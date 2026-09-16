export const POPULARITY_WINDOW_DAYS = 90;
export const POPULARITY_MIN_ORDERS = 10;
export const POPULARITY_MIN_CLIENTS = 5;
export const POPULARITY_VALID_DAYS = 7;

type OrderForPopularity = {
  id: string;
  clientId: string;
  createdAt: Date;
  type: string;
  status: string;
  items: ReadonlyArray<{ productSlug: string }>;
};

export type PopularityCandidate = {
  version: 1;
  source: "crm-completed-orders";
  status: "ready" | "insufficient";
  windowDays: 90;
  windowStart: string;
  generatedAt: string;
  expiresAt: string;
  eligibleOrders: number;
  distinctClients: number;
  counts: Array<{ slug: string; orderCount: number }>;
  quarantinedSlugs: string[];
};

export function popularityWindow(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid popularity generation date");
  return new Date(now.getTime() - POPULARITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function createPopularityCandidate(
  orders: ReadonlyArray<OrderForPopularity>,
  publishedSlugs: ReadonlySet<string>,
  now: Date,
): PopularityCandidate {
  const start = popularityWindow(now);
  const counts = new Map<string, number>();
  const clients = new Set<string>();
  const unknown = new Set<string>();
  let eligibleOrders = 0;

  for (const order of orders) {
    if (
      order.type !== "order" ||
      order.status !== "DONE" ||
      order.id.startsWith("demo-") ||
      !Number.isFinite(order.createdAt.getTime()) ||
      order.createdAt < start ||
      order.createdAt >= now
    )
      continue;

    const uniqueSlugs = new Set(order.items.map((item) => item.productSlug));
    let hasPublishedProduct = false;
    for (const slug of uniqueSlugs) {
      if (!publishedSlugs.has(slug)) {
        unknown.add(slug);
        continue;
      }
      hasPublishedProduct = true;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    if (hasPublishedProduct) {
      eligibleOrders += 1;
      clients.add(order.clientId);
    }
  }

  return {
    version: 1,
    source: "crm-completed-orders",
    status:
      eligibleOrders >= POPULARITY_MIN_ORDERS && clients.size >= POPULARITY_MIN_CLIENTS && unknown.size === 0
        ? "ready"
        : "insufficient",
    windowDays: POPULARITY_WINDOW_DAYS,
    windowStart: start.toISOString(),
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + POPULARITY_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    eligibleOrders,
    distinctClients: clients.size,
    counts: [...counts]
      .map(([slug, orderCount]) => ({ slug, orderCount }))
      .sort((left, right) => right.orderCount - left.orderCount || left.slug.localeCompare(right.slug)),
    quarantinedSlugs: [...unknown].sort(),
  };
}
