"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import type {
  CatalogProductView,
  ClientView,
  DashboardRange,
  DashboardStats,
  OrderStatus,
  OrdersResult,
  OrderType,
} from "@/lib/crm-types";
import { ORDER_STATUSES, ORDER_TYPES } from "@/lib/crm-types";
import { prisma } from "@/lib/prisma";
import { getProductName, products } from "@/lib/products";
import { requireCrmAccess } from "@/server/crm-auth";

import { deleteOrderFromDb } from "../../../server/applications/application-db";
import { fixedPriceSchema } from "../../../server/catalog/fixed-prices";
import { aggregateDashboard, normalizeRange, startDateForRange } from "./dashboard/_components/dashboard-data";

const statusSchema = z.enum(ORDER_STATUSES);
const typeSchema = z.enum(ORDER_TYPES);

type OrderFilters = {
  status?: string;
  type?: string;
  region?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
};

function toStatus(value: string): OrderStatus {
  const parsed = statusSchema.safeParse(value);
  return parsed.success ? parsed.data : "NEW";
}

function toType(value: string): OrderType {
  const parsed = typeSchema.safeParse(value);
  return parsed.success ? parsed.data : "order";
}

function parseHistory(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch (error) {
    console.warn("Cannot parse order session history", error);
    return [];
  }
}

export async function getDashboardStats(requestedRange: DashboardRange): Promise<DashboardStats> {
  await requireCrmAccess();
  const range = normalizeRange(requestedRange);
  const now = new Date();
  const start = startDateForRange(range, now);
  const previousStart = start ? new Date(2 * start.getTime() - now.getTime()) : undefined;
  const statusQuery = prisma.order.groupBy({
    by: ["status"],
    orderBy: { status: "asc" },
    where: { createdAt: { lt: now } },
    _count: { _all: true },
  });
  const [orders, statuses, newClients, previousNewClients, recent] = await prisma.$transaction(
    [
      prisma.order.findMany({
        where: { createdAt: { gte: previousStart, lt: now } },
        select: {
          createdAt: true,
          status: true,
          type: true,
          utmSource: true,
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
      statusQuery,
      prisma.client.count({ where: { createdAt: { gte: start, lt: now } } }),
      prisma.client.count({ where: { createdAt: { gte: previousStart, lt: start ?? new Date(0) } } }),
      prisma.order.findMany({
        where: { createdAt: { gte: start, lt: now } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 8,
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          client: { select: { firstName: true, lastName: true } },
          items: { select: { productSlug: true } },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return aggregateDashboard({
    orders,
    range,
    now,
    newClients,
    previousNewClients,
    statuses: statuses.map((row) => ({ status: row.status, count: row._count._all })),
    productNames: new Map(products.map((product) => [product.slug, product.name])),
    recentOrders: recent.map((order) => ({
      id: order.id,
      clientName: `${order.client.firstName} ${order.client.lastName}`.trim(),
      type: order.type,
      status: toStatus(order.status),
      createdAt: order.createdAt.toISOString(),
      productNames: order.items.map((item) => getProductName(item.productSlug)),
    })),
  });
}

export async function getOrders(filters: OrderFilters = {}): Promise<OrdersResult> {
  await requireCrmAccess();
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = 20;
  const where: Prisma.OrderWhereInput = {};
  const parsedStatus = statusSchema.safeParse(filters.status);
  const parsedType = typeSchema.safeParse(filters.type);

  if (parsedStatus.success) where.status = parsedStatus.data;
  if (parsedType.success) where.type = parsedType.data;
  if (filters.region) where.client = { region: filters.region };
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { id: { contains: search } },
      { client: { firstName: { contains: search } } },
      { client: { lastName: { contains: search } } },
      { client: { phone: { contains: search } } },
      { client: { phoneNormalized: { contains: search } } },
    ];
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(`${filters.from}T00:00:00`);
    if (filters.to) where.createdAt.lte = new Date(`${filters.to}T23:59:59.999`);
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        items: true,
        client: {
          include: {
            orders: {
              select: { id: true, createdAt: true, status: true, type: true },
              orderBy: { createdAt: "desc" },
              take: 8,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      type: toType(order.type),
      status: toStatus(order.status),
      comment: order.comment,
      preferredCallTime: order.preferredCallTime,
      eventDate: order.eventDate,
      eventTime: order.eventTime,
      masterclassTopic: order.masterclassTopic,
      consultationMode: order.consultationMode,
      utmSource: order.utmSource,
      utmMedium: order.utmMedium,
      utmCampaign: order.utmCampaign,
      entryPoint: order.entryPoint,
      sessionHistory: parseHistory(order.sessionHistory),
      client: {
        id: order.client.id,
        firstName: order.client.firstName,
        lastName: order.client.lastName,
        phone: order.client.phone,
        phoneNormalized: order.client.phoneNormalized,
        email: order.client.email,
        region: order.client.region,
        previousOrders: order.client.orders
          .filter((previous) => previous.id !== order.id)
          .map((previous) => ({
            id: previous.id,
            createdAt: previous.createdAt.toISOString(),
            status: toStatus(previous.status),
            type: toType(previous.type),
          })),
      },
      items: order.items.map((item) => ({
        id: item.id,
        productSlug: item.productSlug,
        name: getProductName(item.productSlug),
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
      })),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getOrderRegions() {
  await requireCrmAccess();
  const regions = await prisma.client.findMany({
    distinct: ["region"],
    select: { region: true },
    orderBy: { region: "asc" },
  });
  return regions.map((entry) => entry.region).filter(Boolean);
}

export async function updateOrderStatus(orderId: string, nextStatus: string) {
  await requireCrmAccess();
  const parsedId = z.string().trim().min(1).max(100).safeParse(orderId);
  const parsedStatus = statusSchema.safeParse(nextStatus);
  if (!parsedId.success || !parsedStatus.success) {
    return { ok: false, message: "Некорректный заказ или статус." };
  }

  const existing = await prisma.order.findUnique({ where: { id: parsedId.data }, select: { id: true } });
  if (!existing) return { ok: false, message: "Заявка не найдена." };

  await prisma.order.update({ where: { id: parsedId.data }, data: { status: parsedStatus.data } });
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/clients");
  revalidatePath("/results");
  return { ok: true, message: "Статус обновлён." };
}

export async function deleteOrder(orderId: string) {
  await requireCrmAccess();
  const parsedId = z.string().trim().min(1).max(100).safeParse(orderId);
  if (!parsedId.success) {
    return { ok: false, message: "Некорректный идентификатор заявки." };
  }

  const deleted = await deleteOrderFromDb(parsedId.data, prisma);
  if (!deleted) return { ok: false, message: "Заявка уже удалена или не найдена." };

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/clients");
  revalidatePath("/results");
  return { ok: true, message: "Заявка удалена." };
}

export async function getClients(search = ""): Promise<ClientView[]> {
  await requireCrmAccess();
  const normalizedSearch = search.trim();
  const clients = await prisma.client.findMany({
    where: normalizedSearch
      ? {
          OR: [
            { firstName: { contains: normalizedSearch } },
            { lastName: { contains: normalizedSearch } },
            { phone: { contains: normalizedSearch } },
            { email: { contains: normalizedSearch } },
          ],
        }
      : undefined,
    include: {
      orders: {
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return clients.map((client) => {
    const orderedChronologically = [...client.orders].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    return {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      phoneNormalized: client.phoneNormalized,
      email: client.email,
      region: client.region,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      orderCount: client.orders.length,
      firstOrderAt: orderedChronologically[0]?.createdAt.toISOString() ?? null,
      lastOrderAt: orderedChronologically.at(-1)?.createdAt.toISOString() ?? null,
      totalValue: client.orders.reduce(
        (total, order) =>
          total + order.items.reduce((orderTotal, item) => orderTotal + item.priceAtPurchase * item.quantity, 0),
        0,
      ),
      orders: client.orders.map((order) => ({
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        type: toType(order.type),
        status: toStatus(order.status),
        value: order.items.reduce((total, item) => total + item.priceAtPurchase * item.quantity, 0),
      })),
    };
  });
}

export async function getCatalogProducts(): Promise<CatalogProductView[]> {
  await requireCrmAccess();
  const prices = await prisma.productCatalog.findMany();
  const priceMap = new Map(prices.map((price) => [price.slug, price]));
  return products.map((product) => {
    const price = priceMap.get(product.slug);
    return {
      ...product,
      internalPrice: price?.internalPrice ?? 0,
      retailPrice: price?.retailPrice ?? 0,
      distributorPrice: price?.distributorPrice ?? 0,
      updatedAt: price?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function updateProductPrice(
  slug: string,
  _previousState: { ok: boolean; message: string },
  formData: FormData,
) {
  await requireCrmAccess();
  const product = products.find((candidate) => candidate.slug === slug);
  const retail = fixedPriceSchema.safeParse(formData.get("retailPrice"));
  const distributor = fixedPriceSchema.safeParse(formData.get("distributorPrice"));
  if (!product || !retail.success || !distributor.success) {
    return {
      ok: false,
      message: "Укажите обе утверждённые цены: от 0,01 до 1 000 000 MDL, до двух знаков после запятой.",
    };
  }

  await prisma.productCatalog.upsert({
    where: { slug },
    create: { slug, sku: product.sku, retailPrice: retail.data, distributorPrice: distributor.data },
    update: { sku: product.sku, retailPrice: retail.data, distributorPrice: distributor.data },
  });
  revalidatePath("/catalog");
  revalidatePath("/results");
  revalidatePath("/dashboard");
  return { ok: true, message: "Утверждённые цены сохранены. Снимки старых заказов не изменены." };
}
