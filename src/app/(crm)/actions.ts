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

const statusSchema = z.enum(ORDER_STATUSES);
const typeSchema = z.enum(ORDER_TYPES);
const rangeSchema = z.enum(["7d", "30d", "all"]);
const priceSchema = z.coerce.number().finite().min(0).max(1_000_000);

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

function startDateForRange(range: DashboardRange) {
  if (range === "all") return undefined;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (range === "7d" ? 6 : 29));
  return start;
}

function timelineKey(date: Date, range: DashboardRange) {
  if (range === "all") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return date.toISOString().slice(0, 10);
}

function timelineLabel(key: string, range: DashboardRange) {
  const date = range === "all" ? new Date(`${key}-01T12:00:00`) : new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat("ru-MD", {
    month: range === "all" ? "short" : "numeric",
    day: range === "all" ? undefined : "numeric",
    year: range === "all" ? "2-digit" : undefined,
  }).format(date);
}

export async function getDashboardStats(requestedRange: DashboardRange): Promise<DashboardStats> {
  await requireCrmAccess();
  const range = rangeSchema.catch("30d").parse(requestedRange);
  const startDate = startDateForRange(range);

  const [total, processing, delivery, done, timelineOrders, locationOrders, sources, topProducts, doneOrders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "PROCESSING" } }),
      prisma.order.count({ where: { status: "DELIVERY" } }),
      prisma.order.count({ where: { status: "DONE" } }),
      prisma.order.findMany({
        where: startDate ? { createdAt: { gte: startDate } } : undefined,
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.order.findMany({ select: { client: { select: { region: true } } } }),
      prisma.order.groupBy({ by: ["utmSource"], _count: { _all: true }, orderBy: { _count: { utmSource: "desc" } } }),
      prisma.orderItem.groupBy({
        by: ["productSlug"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      }),
      prisma.order.findMany({ where: { status: "DONE" }, select: { items: true } }),
    ]);

  const timelineMap = new Map<string, number>();
  for (const order of timelineOrders) {
    const key = timelineKey(order.createdAt, range);
    timelineMap.set(key, (timelineMap.get(key) ?? 0) + 1);
  }

  if (range !== "all") {
    const days = range === "7d" ? 7 : 30;
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const key = timelineKey(date, range);
      if (!timelineMap.has(key)) timelineMap.set(key, 0);
    }
  }

  const regionMap = new Map<string, number>();
  for (const order of locationOrders) {
    const region = order.client.region.trim() || "Не указан";
    regionMap.set(region, (regionMap.get(region) ?? 0) + 1);
  }

  const completedTurnover = doneOrders.reduce(
    (orderTotal, order) =>
      orderTotal + order.items.reduce((itemTotal, item) => itemTotal + item.priceAtPurchase * item.quantity, 0),
    0,
  );

  return {
    kpis: { total, processing, delivery, done },
    timeline: [...timelineMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, orders]) => ({ label: timelineLabel(key, range), orders })),
    regions: [...regionMap.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([region, orders]) => ({ region, orders })),
    sources: sources.map((source) => ({
      source: source.utmSource?.trim() || "Прямой трафик",
      orders: source._count._all,
    })),
    products: topProducts.map((product) => ({
      slug: product.productSlug,
      name: getProductName(product.productSlug),
      quantity: product._sum.quantity ?? 0,
    })),
    completedTurnover,
  };
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
  return { ok: true, message: "Статус обновлён." };
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
  const parsedPrice = priceSchema.safeParse(formData.get("internalPrice"));
  if (!product || !parsedPrice.success) {
    return { ok: false, message: "Проверьте внутреннюю цену." };
  }

  await prisma.productCatalog.upsert({
    where: { slug },
    create: { slug, sku: product.sku, internalPrice: parsedPrice.data },
    update: { sku: product.sku, internalPrice: parsedPrice.data },
  });
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  return { ok: true, message: "Цена сохранена." };
}
