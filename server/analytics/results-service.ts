import { prisma } from "../../src/lib/prisma";
import { products } from "../../src/lib/products";
import { requireCrmAccess } from "../../src/server/crm-auth";
import { calculateOperationalResults } from "./operational-results";
import { calculateResults, getPeriodRanges, type ResultsPeriod } from "./results-calculations";

export async function getResultsData(period: ResultsPeriod) {
  await requireCrmAccess();
  const now = new Date();
  const { fetchStart, previousStart, end } = getPeriodRanges(period, now);
  const [orders, prices, operationalOrders] = await prisma.$transaction(
    [
      prisma.order.findMany({
        where: { status: "DONE", type: "order", createdAt: { gte: fetchStart, lt: end } },
        select: {
          createdAt: true,
          status: true,
          type: true,
          client: { select: { region: true } },
          items: {
            select: {
              productSlug: true,
              quantity: true,
              retailPriceAtPurchase: true,
              distributorPriceAtPurchase: true,
            },
          },
        },
      }),
      prisma.productCatalog.findMany({ select: { slug: true, retailPrice: true, distributorPrice: true } }),
      prisma.order.findMany({
        where: { type: "order", createdAt: { gte: previousStart, lt: end } },
        select: { id: true, createdAt: true, status: true, firstActionAt: true, submittedRegion: true },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  const pricesBySlug = new Map(prices.map((price) => [price.slug, price]));
  const sales = calculateResults(
    orders,
    products.map((product) => ({
      ...product,
      retailPrice: pricesBySlug.get(product.slug)?.retailPrice ?? 0,
      distributorPrice: pricesBySlug.get(product.slug)?.distributorPrice ?? 0,
    })),
    period,
    now,
  );
  return {
    ...sales,
    operations: calculateOperationalResults(operationalOrders, period, now),
    demoOrdersInComparison: operationalOrders.filter((order) => order.id.startsWith("demo-analytics-order-")).length,
  };
}
