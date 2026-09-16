import { prisma } from "../../src/lib/prisma";
import { products } from "../../src/lib/products";
import { createPopularityCandidate, popularityWindow } from "./ranking";

const PAGE_SIZE = 1_000;
const MAX_ORDERS = 50_000;

export async function getPopularityCandidate(now = new Date()) {
  const orders = [];
  let cursor: string | undefined;
  const start = popularityWindow(now);

  for (;;) {
    const page = await prisma.order.findMany({
      where: { type: "order", status: "DONE", createdAt: { gte: start, lt: now } },
      select: {
        id: true,
        clientId: true,
        createdAt: true,
        type: true,
        status: true,
        items: { select: { productSlug: true } },
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    orders.push(...page);
    if (orders.length > MAX_ORDERS) throw new Error("Popularity window exceeds safe export size");
    if (page.length < PAGE_SIZE) break;
    cursor = page.at(-1)?.id;
  }

  return createPopularityCandidate(orders, new Set(products.map((product) => product.slug)), now);
}
