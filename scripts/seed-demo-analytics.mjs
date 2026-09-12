import { PrismaClient } from "@prisma/client";

import products from "../src/data/products.json" with { type: "json" };
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const DAY = 86_400_000;
const DEMO_PREFIX = "demo-analytics";
const DEMO_CAMPAIGN = "demo-analytics-seed";
const supportedArguments = new Set(["--allow-remote", "--cleanup", "--dry-run", "--json"]);
const argumentsSet = new Set(process.argv.slice(2));
const unknownArguments = [...argumentsSet].filter((argument) => !supportedArguments.has(argument));

if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
}

if (argumentsSet.has("--cleanup") && argumentsSet.has("--dry-run")) {
  throw new Error("Use either --cleanup or --dry-run, not both.");
}

const categoryRetailBase = {
  Кремы: 620,
  Напитки: 340,
  Парфюмерия: 980,
  "Пищевые добавки": 520,
  Гигиена: 260,
};

const clients = [
  {
    id: `${DEMO_PREFIX}-client-01`,
    firstName: "DEMO Анна",
    lastName: "Руссу",
    phone: "+373 000 00 001",
    phoneNormalized: "+37300000001",
    email: "demo.anna@example.invalid",
    region: "Кишинёв",
    createdDaysAgo: 90,
  },
  {
    id: `${DEMO_PREFIX}-client-02`,
    firstName: "DEMO Виктор",
    lastName: "Чебан",
    phone: "+373 000 00 002",
    phoneNormalized: "+37300000002",
    email: "demo.victor@example.invalid",
    region: "Бельцы",
    createdDaysAgo: 28,
  },
  {
    id: `${DEMO_PREFIX}-client-03`,
    firstName: "DEMO Мария",
    lastName: "Лунгу",
    phone: "+373 000 00 003",
    phoneNormalized: "+37300000003",
    email: "demo.maria@example.invalid",
    region: "Оргеевский район (Orhei)",
    createdDaysAgo: 170,
  },
  {
    id: `${DEMO_PREFIX}-client-04`,
    firstName: "DEMO Ион",
    lastName: "Морару",
    phone: "+373 000 00 004",
    phoneNormalized: "+37300000004",
    email: "demo.ion@example.invalid",
    region: "Кагульский район (Cahul)",
    createdDaysAgo: 50,
  },
  {
    id: `${DEMO_PREFIX}-client-05`,
    firstName: "DEMO Елена",
    lastName: "Попеску",
    phone: "+373 000 00 005",
    phoneNormalized: "+37300000005",
    email: "demo.elena@example.invalid",
    region: "Унгенский район (Ungheni)",
    createdDaysAgo: 55,
  },
  {
    id: `${DEMO_PREFIX}-client-06`,
    firstName: "DEMO Сергей",
    lastName: "Ротару",
    phone: "+373 000 00 006",
    phoneNormalized: "+37300000006",
    email: "demo.sergei@example.invalid",
    region: "Гагаузия (АТО)",
    createdDaysAgo: 120,
  },
];

const orders = [
  {
    client: 0,
    daysAgo: 1,
    hourUtc: 7,
    status: "DONE",
    source: "instagram",
    items: [
      ["solaris-body-lotion", 2],
      ["gonseen", 1],
    ],
  },
  {
    client: 1,
    daysAgo: 3,
    hourUtc: 16,
    status: "DONE",
    source: "google",
    items: [
      ["dynamic-hydrating-cream", 1],
      ["face-soap", 2],
    ],
  },
  { client: 2, daysAgo: 5, hourUtc: 9, status: "NEW", source: "direct", items: [["lord-deodorant", 2]] },
  {
    client: 0,
    daysAgo: 7,
    hourUtc: 12,
    status: "PROCESSING",
    source: "facebook",
    items: [
      ["body-butter", 1],
      ["conditioner", 1],
    ],
  },
  {
    client: 3,
    daysAgo: 10,
    hourUtc: 18,
    status: "DONE",
    source: "instagram",
    items: [
      ["gonseen", 3],
      ["chocoseen", 1],
    ],
  },
  {
    client: 4,
    daysAgo: 14,
    hourUtc: 6,
    status: "DELIVERY",
    source: "referral",
    items: [
      ["after-shave-lord", 1],
      ["shower-gel-lord", 2],
    ],
  },
  {
    client: 5,
    daysAgo: 21,
    hourUtc: 14,
    status: "CANCELLED",
    source: "google",
    items: [
      ["anti-aging-serum", 1],
      ["eye-contour-balm", 1],
    ],
  },
  {
    client: 1,
    daysAgo: 27,
    hourUtc: 10,
    status: "DONE",
    source: "instagram",
    items: [
      ["frequent-use-tonic-shampoo", 2],
      ["conditioner", 2],
    ],
  },
  {
    client: 2,
    daysAgo: 35,
    hourUtc: 8,
    status: "DONE",
    source: "facebook",
    items: [
      ["solaris-body-lotion", 1],
      ["dynamic-hydrating-cream", 1],
    ],
  },
  {
    client: 3,
    daysAgo: 43,
    hourUtc: 17,
    status: "DONE",
    source: "google",
    items: [
      ["imunseen", 2],
      ["goldseen", 1],
    ],
  },
  { client: 4, daysAgo: 52, hourUtc: 11, status: "CANCELLED", source: "instagram", items: [["perfume-lady", 1]] },
  {
    client: 5,
    daysAgo: 68,
    hourUtc: 15,
    status: "DONE",
    source: "direct",
    items: [
      ["face-milk", 2],
      ["night-cream", 1],
    ],
  },
  {
    client: 0,
    daysAgo: 79,
    hourUtc: 7,
    status: "DONE",
    source: "facebook",
    items: [
      ["gonseen", 1],
      ["coffee-mix", 2],
    ],
  },
  { client: 5, daysAgo: 105, hourUtc: 13, status: "DONE", source: "google", items: [["salts-camomile", 3]] },
  {
    client: 2,
    daysAgo: 150,
    hourUtc: 9,
    status: "DONE",
    source: "referral",
    items: [
      ["solaris-body-lotion", 2],
      ["body-butter", 1],
    ],
  },
].map((order, index) => ({ ...order, id: `${DEMO_PREFIX}-order-${String(index + 1).padStart(2, "0")}` }));

function roundToFive(value) {
  return Math.round(value / 5) * 5;
}

function plannedPrices() {
  const categoryOffsets = new Map();
  return products.map((product) => {
    const categoryIndex = categoryOffsets.get(product.category) ?? 0;
    categoryOffsets.set(product.category, categoryIndex + 1);
    const base = categoryRetailBase[product.category];
    if (!base) throw new Error(`No demo price rule for category: ${product.category}`);
    const retailPrice = roundToFive(base + categoryIndex * 35);
    const distributorPrice = roundToFive(retailPrice * 0.62);
    return { slug: product.slug, sku: product.sku, retailPrice, distributorPrice };
  });
}

function planSummary() {
  const prices = plannedPrices();
  const clientOrderCounts = clients.map((_, client) => orders.filter((order) => order.client === client).length);
  const statusCounts = Object.fromEntries(
    [...new Set(orders.map((order) => order.status))]
      .sort()
      .map((status) => [status, orders.filter((order) => order.status === status).length]),
  );
  return {
    fixture: DEMO_CAMPAIGN,
    clients: clients.length,
    orders: orders.length,
    orderItems: orders.reduce((total, order) => total + order.items.length, 0),
    productPrices: prices.length,
    statuses: statusCounts,
    minOrdersPerClient: Math.min(...clientOrderCounts),
    maxOrdersPerClient: Math.max(...clientOrderCounts),
    orderAgesDays: orders.map((order) => order.daysAgo),
    retailPriceRange: [
      Math.min(...prices.map((price) => price.retailPrice)),
      Math.max(...prices.map((price) => price.retailPrice)),
    ],
    distributorPriceRange: [
      Math.min(...prices.map((price) => price.distributorPrice)),
      Math.max(...prices.map((price) => price.distributorPrice)),
    ],
  };
}

function dateAtDaysAgo(now, daysAgo, hourUtc = 10) {
  const date = new Date(now.getTime() - daysAgo * DAY);
  date.setUTCHours(hourUtc, (daysAgo * 7) % 60, 0, 0);
  return date;
}

function writeResult(result) {
  if (argumentsSet.has("--json")) console.log(JSON.stringify(result));
  else console.log(JSON.stringify(result, null, 2));
}

function loadEnvironment() {
  const inheritedVariables = new Set(Object.keys(process.env));
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
      if (!inheritedVariables.has(key)) process.env[key] = value;
    }
  }
}

if (argumentsSet.has("--dry-run")) {
  writeResult({ mode: "dry-run", ...planSummary() });
  process.exit(0);
}

loadEnvironment();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
const databaseUrl = new URL(process.env.DATABASE_URL);
const isRemote = !["localhost", "127.0.0.1"].includes(databaseUrl.hostname);
if (isRemote && !argumentsSet.has("--allow-remote")) {
  throw new Error("Refusing to change a remote database without --allow-remote.");
}

const prisma = new PrismaClient();
const demoClientIds = clients.map((client) => client.id);
const demoOrderIds = orders.map((order) => order.id);

try {
  if (argumentsSet.has("--cleanup")) {
    const result = await prisma.$transaction(async (transaction) => {
      const orderItems = await transaction.orderItem.deleteMany({ where: { orderId: { in: demoOrderIds } } });
      const deletedOrders = await transaction.order.deleteMany({ where: { id: { in: demoOrderIds } } });
      const deletedClients = await transaction.client.deleteMany({ where: { id: { in: demoClientIds } } });
      return {
        mode: "cleanup",
        deletedClients: deletedClients.count,
        deletedOrders: deletedOrders.count,
        deletedOrderItems: orderItems.count,
        note: "Demo catalogue prices are retained and can be edited from /catalog.",
      };
    });
    writeResult(result);
    process.exit(0);
  }

  const now = new Date();
  const result = await prisma.$transaction(
    async (transaction) => {
      const unexpectedOrders = await transaction.order.count({
        where: { clientId: { in: demoClientIds }, id: { notIn: demoOrderIds } },
      });
      if (unexpectedOrders > 0) {
        throw new Error("Demo client IDs own unexpected orders; cleanup stopped to protect data.");
      }

      await transaction.orderItem.deleteMany({ where: { orderId: { in: demoOrderIds } } });
      await transaction.order.deleteMany({ where: { id: { in: demoOrderIds } } });
      await transaction.client.deleteMany({ where: { id: { in: demoClientIds } } });

      const existingPrices = await transaction.productCatalog.findMany({
        where: { slug: { in: products.map((product) => product.slug) } },
      });
      const existingPriceMap = new Map(existingPrices.map((price) => [price.slug, price]));
      const effectivePrices = new Map();
      let preservedPricePairs = 0;
      let filledPricePairs = 0;

      for (const demoPrice of plannedPrices()) {
        const existing = existingPriceMap.get(demoPrice.slug);
        const retailPrice = existing?.retailPrice > 0 ? existing.retailPrice : demoPrice.retailPrice;
        const distributorPrice =
          existing?.distributorPrice > 0 ? existing.distributorPrice : demoPrice.distributorPrice;
        const internalPrice = existing?.internalPrice > 0 ? existing.internalPrice : distributorPrice;
        if (existing?.retailPrice > 0 && existing?.distributorPrice > 0) preservedPricePairs += 1;
        else filledPricePairs += 1;
        await transaction.productCatalog.upsert({
          where: { slug: demoPrice.slug },
          create: {
            slug: demoPrice.slug,
            sku: demoPrice.sku,
            internalPrice,
            retailPrice,
            distributorPrice,
          },
          update: { sku: demoPrice.sku, internalPrice, retailPrice, distributorPrice },
        });
        effectivePrices.set(demoPrice.slug, { retailPrice, distributorPrice });
      }

      await transaction.client.createMany({
        data: clients.map(({ createdDaysAgo, ...client }) => ({
          ...client,
          createdAt: dateAtDaysAgo(now, createdDaysAgo, 8),
        })),
      });

      let orderItems = 0;
      for (const [index, order] of orders.entries()) {
        const client = clients[order.client];
        if (!client) throw new Error(`Missing demo client ${order.client}`);
        await transaction.order.create({
          data: {
            id: order.id,
            clientId: client.id,
            type: "order",
            status: order.status,
            comment: `[DEMO] Заказ ${index + 1} для проверки графиков и формул`,
            utmSource: order.source,
            utmMedium: order.source === "direct" ? "none" : "demo",
            utmCampaign: DEMO_CAMPAIGN,
            utmContent: `order-${String(index + 1).padStart(2, "0")}`,
            entryPoint: "/demo/analytics-seed",
            sessionHistory: JSON.stringify(order.items.map(([slug]) => slug)),
            createdAt: dateAtDaysAgo(now, order.daysAgo, order.hourUtc),
            items: {
              create: order.items.map(([productSlug, quantity]) => {
                const price = effectivePrices.get(productSlug);
                if (!price) throw new Error(`Missing demo price for ${productSlug}`);
                orderItems += 1;
                return {
                  productSlug,
                  quantity,
                  priceAtPurchase: price.retailPrice,
                  retailPriceAtPurchase: price.retailPrice,
                  distributorPriceAtPurchase: price.distributorPrice,
                };
              }),
            },
          },
        });
      }

      return {
        mode: "seed",
        connection: isRemote ? "remote" : "local",
        clients: clients.length,
        orders: orders.length,
        orderItems,
        productPrices: products.length,
        filledPricePairs,
        preservedPricePairs,
        generatedAt: now.toISOString(),
      };
    },
    { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 },
  );
  writeResult(result);
} finally {
  await prisma.$disconnect();
}
