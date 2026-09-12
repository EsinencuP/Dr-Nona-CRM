import { MOLDOVA_REGIONS } from "../../shared/constants/moldova-regions";

export const PERIOD_DAYS = { "1m": 30, "3m": 90, "6m": 180, "1y": 365 } as const;
export type ResultsPeriod = keyof typeof PERIOD_DAYS;
const DAY = 86_400_000;

export function parseResultsPeriod(value: unknown): ResultsPeriod {
  return typeof value === "string" && Object.hasOwn(PERIOD_DAYS, value) ? (value as ResultsPeriod) : "1m";
}

export function getPeriodRanges(period: ResultsPeriod, now: Date) {
  const end = now.getTime();
  const span = PERIOD_DAYS[period] * DAY;
  return {
    end: new Date(end),
    start: new Date(end - span),
    previousStart: new Date(end - span * 2),
    fetchStart: new Date(Math.min(end - span * 2, end - 90 * DAY)),
  };
}

export type SalesOrder = {
  createdAt: Date;
  status: string;
  type: string;
  client: { region: string };
  items: { productSlug: string; quantity: number; retailPriceAtPurchase: number; distributorPriceAtPurchase: number }[];
};
export type ResultsProduct = {
  slug: string;
  name: string;
  sku: string;
  category: string;
  retailPrice: number;
  distributorPrice: number;
};
export type Comparison = {
  value: number | null;
  previous: number | null;
  delta: number | null;
  percent: number | null;
};

export function compare(value: number | null, previous: number | null): Comparison {
  return {
    value,
    previous,
    delta: value === null || previous === null ? null : value - previous,
    percent:
      value === null || previous === null || previous === 0 ? null : ((value - previous) / Math.abs(previous)) * 100,
  };
}

function validPrice(price: number) {
  return Number.isFinite(price) && price > 0;
}
function validQuantity(quantity: number) {
  return Number.isSafeInteger(quantity) && quantity > 0;
}

function totals(orders: SalesOrder[]) {
  let units = 0;
  let revenue = 0;
  let cost = 0;
  let missingRetail = 0;
  let missingCost = 0;
  for (const order of orders) {
    let retailIncomplete = order.items.length === 0;
    let costIncomplete = order.items.length === 0;
    for (const item of order.items) {
      if (!validQuantity(item.quantity)) {
        retailIncomplete = true;
        costIncomplete = true;
        continue;
      }
      units += item.quantity;
      if (validPrice(item.retailPriceAtPurchase))
        revenue += Math.round(item.retailPriceAtPurchase * 100) * item.quantity;
      else retailIncomplete = true;
      if (validPrice(item.distributorPriceAtPurchase))
        cost += Math.round(item.distributorPriceAtPurchase * 100) * item.quantity;
      else costIncomplete = true;
    }
    if (retailIncomplete) missingRetail += 1;
    if (costIncomplete) missingCost += 1;
  }
  return {
    orders: orders.length,
    units,
    missingRetail,
    missingCost,
    revenue: missingRetail ? null : revenue / 100,
    profit: missingRetail || missingCost ? null : (revenue - cost) / 100,
    average: missingRetail ? null : revenue / 100 / Math.max(orders.length, 1),
  };
}

export function forecastUnits(recent: number, middle: number, oldest: number) {
  const velocity = recent * 0.5 + middle * 0.3 + oldest * 0.2;
  const growth = middle === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (recent - middle) / middle));
  const months = [1, 2, 3].map((month) => Math.ceil(velocity * (1 + growth) ** month));
  return { velocity, growth, months, reorder: Math.ceil((months[0] ?? 0) * 1.15) };
}

export function seasonalAdvice(catalog: ResultsProduct[], now: Date) {
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Chisinau" }).format(now));
  const rules = [
    {
      id: "spring",
      label: "Весна и лето · Solaris",
      month: 3,
      products: catalog.filter(
        (product) => product.slug === "solaris-body-lotion" || product.slug === "facial-solaris",
      ),
    },
    {
      id: "autumn",
      label: "Осень и зима · чай и добавки",
      month: 9,
      products: catalog.filter((product) => product.slug === "gonseen" || product.category === "Пищевые добавки"),
    },
  ];
  return rules
    .filter((rule) => rule.products.length > 0)
    .map((rule) => {
      let target = Date.UTC(year, rule.month, 1);
      if (target < now.getTime()) target = Date.UTC(year + 1, rule.month, 1);
      return {
        id: rule.id,
        label: rule.label,
        target: new Date(target).toISOString(),
        prepareFrom: new Date(target - 45 * DAY).toISOString(),
        prepareTo: new Date(target - 30 * DAY).toISOString(),
        due: now.getTime() >= target - 45 * DAY && now.getTime() < target,
        productNames: rule.products.map((product) => product.name),
      };
    });
}

export function calculateResults(orders: SalesOrder[], catalog: ResultsProduct[], period: ResultsPeriod, now: Date) {
  const ranges = getPeriodRanges(period, now);
  const eligible = orders.filter(
    (order) =>
      order.status === "DONE" &&
      order.type === "order" &&
      order.createdAt < ranges.end &&
      order.createdAt >= ranges.fetchStart,
  );
  const current = eligible.filter((order) => order.createdAt >= ranges.start);
  const previous = eligible.filter(
    (order) => order.createdAt >= ranges.previousStart && order.createdAt < ranges.start,
  );
  const currentTotals = totals(current);
  const previousTotals = totals(previous);
  const productMap = new Map(catalog.map((product) => [product.slug, product]));
  for (const order of eligible) {
    for (const item of order.items) {
      if (!productMap.has(item.productSlug))
        productMap.set(item.productSlug, {
          slug: item.productSlug,
          name: item.productSlug,
          sku: "Нет в каталоге",
          category: "",
          retailPrice: 0,
          distributorPrice: 0,
        });
    }
  }
  const skuCounts = new Map<
    string,
    { current: number; previous: number; recent: number; middle: number; oldest: number }
  >();
  for (const order of eligible) {
    const age = (now.getTime() - order.createdAt.getTime()) / DAY;
    for (const item of order.items) {
      if (!validQuantity(item.quantity)) continue;
      const count = skuCounts.get(item.productSlug) ?? { current: 0, previous: 0, recent: 0, middle: 0, oldest: 0 };
      if (order.createdAt >= ranges.start) count.current += item.quantity;
      else if (order.createdAt >= ranges.previousStart) count.previous += item.quantity;
      if (age <= 30) count.recent += item.quantity;
      else if (age <= 60) count.middle += item.quantity;
      else if (age <= 90) count.oldest += item.quantity;
      skuCounts.set(item.productSlug, count);
    }
  }
  const skus = [...productMap.values()]
    .map((product) => {
      const count = skuCounts.get(product.slug) ?? { current: 0, previous: 0, recent: 0, middle: 0, oldest: 0 };
      return {
        ...product,
        units: count.current,
        trend: compare(count.current, count.previous),
        monthlyTrend: compare(count.recent, count.middle),
        ...forecastUnits(count.recent, count.middle, count.oldest),
        margin:
          validPrice(product.retailPrice) && validPrice(product.distributorPrice)
            ? (Math.round(product.retailPrice * 100) - Math.round(product.distributorPrice * 100)) / 100
            : null,
      };
    })
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name, "ru"));

  const regionOrders = new Map<string, SalesOrder[]>(MOLDOVA_REGIONS.map((region) => [region, []]));
  for (const order of current) {
    const region = regionOrders.has(order.client.region) ? order.client.region : "Регион не распознан";
    const group = regionOrders.get(region) ?? [];
    group.push(order);
    regionOrders.set(region, group);
  }
  const regions = [...regionOrders]
    .map(([name, rows]) => {
      const summary = totals(rows);
      return {
        name,
        units: summary.units,
        orders: summary.orders,
        revenue: summary.revenue,
        share: currentTotals.units ? (summary.units / currentTotals.units) * 100 : 0,
      };
    })
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name, "ru"));
  const meanVelocity = skus.length ? skus.reduce((sum, sku) => sum + sku.velocity, 0) / skus.length : 0;
  const masterclass = skus
    .filter((sku) => sku.margin !== null && sku.margin > 0 && sku.velocity <= meanVelocity)
    .sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))
    .slice(0, 3);
  return {
    period,
    start: ranges.start.toISOString(),
    end: ranges.end.toISOString(),
    previousStart: ranges.previousStart.toISOString(),
    current: currentTotals,
    previous: previousTotals,
    kpis: {
      revenue: compare(currentTotals.revenue, previousTotals.revenue),
      units: compare(currentTotals.units, previousTotals.units),
      profit: compare(currentTotals.profit, previousTotals.profit),
      average: compare(currentTotals.average, previousTotals.average),
    },
    skus,
    regions,
    recommendations: {
      seasonal: seasonalAdvice(catalog, now),
      masterclass: masterclass.map(({ slug, name, margin, velocity }) => ({ slug, name, margin, velocity })),
      volume: skus
        .filter((sku) => sku.units > 0)
        .slice(0, 3)
        .map(({ slug, name, units }) => ({ slug, name, units })),
    },
  };
}

export type ResultsData = ReturnType<typeof calculateResults>;
