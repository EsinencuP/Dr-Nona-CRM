import type { Prisma } from "@prisma/client";

import { REPORT_COLUMNS, REPORT_LABELS, type ReportType } from "../../src/lib/export-spec";
import { prisma } from "../../src/lib/prisma";
import { products } from "../../src/lib/products";
import type { parseExportRequest } from "./request";
import type { SpreadsheetValue } from "./xlsx";

export const MAX_EXPORT_ROWS = 10_000;
type ParsedRequest = ReturnType<typeof parseExportRequest>;
type Row = Record<string, SpreadsheetValue>;

const localDate = new Intl.DateTimeFormat("ru-MD", {
  timeZone: "Europe/Chisinau",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function date(value: Date | null | undefined) {
  return value ? localDate.format(value) : null;
}

function isDemo(id: string) {
  return id.startsWith("demo-");
}

function dateWhere(request: ParsedRequest): Prisma.DateTimeFilter | undefined {
  if (!request.fromDate && !request.toDate) return undefined;
  return { ...(request.fromDate ? { gte: request.fromDate } : {}), ...(request.toDate ? { lt: request.toDate } : {}) };
}

function orderWhere(request: ParsedRequest): Prisma.OrderWhereInput {
  return {
    createdAt: dateWhere(request),
    ...(request.includeDemo ? {} : { id: { not: { startsWith: "demo-" } } }),
  };
}

function completeTotal(
  items: ReadonlyArray<{ quantity: number; retailPriceAtPurchase: number; distributorPriceAtPurchase: number }>,
  kind: "retail" | "cost",
) {
  if (!items.length) return null;
  const field = kind === "retail" ? "retailPriceAtPurchase" : "distributorPriceAtPurchase";
  if (
    items.some(
      (item) =>
        !Number.isFinite(item[field]) || item[field] <= 0 || !Number.isSafeInteger(item.quantity) || item.quantity <= 0,
    )
  )
    return null;
  return Math.round(items.reduce((sum, item) => sum + item[field] * item.quantity, 0) * 100) / 100;
}

function rowValues(report: ReportType, columns: string[], records: Row[]) {
  const labels = REPORT_COLUMNS[report] as Record<string, string>;
  return {
    sheetName: REPORT_LABELS[report],
    headers: columns.map((column) => labels[column]),
    rows: records.map((record) => columns.map((column) => record[column] ?? null)),
    rowCount: records.length,
  };
}

async function orderRows(request: ParsedRequest) {
  const orders = await prisma.order.findMany({
    where: orderWhere(request),
    select: {
      id: true,
      createdAt: true,
      type: true,
      status: true,
      submittedFirstName: true,
      submittedLastName: true,
      submittedPhone: true,
      submittedEmail: true,
      submittedRegion: true,
      utmSource: true,
      items: {
        select: { productSlug: true, quantity: true, retailPriceAtPurchase: true, distributorPriceAtPurchase: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_EXPORT_ROWS + 1,
  });
  const names = new Map(products.map((product) => [product.slug, product.name]));
  return orders.map((order): Row => {
    const retailTotal = completeTotal(order.items, "retail");
    const distributorTotal = completeTotal(order.items, "cost");
    return {
      id: order.id,
      createdAt: date(order.createdAt),
      type: order.type,
      status: order.status,
      firstName: order.submittedFirstName,
      lastName: order.submittedLastName,
      phone: order.submittedPhone,
      email: order.submittedEmail,
      region: order.submittedRegion,
      products: order.items.map((item) => names.get(item.productSlug) ?? item.productSlug).join("; "),
      units: order.items.reduce((sum, item) => sum + item.quantity, 0),
      retailTotal,
      distributorTotal,
      margin:
        retailTotal === null || distributorTotal === null
          ? null
          : Math.round((retailTotal - distributorTotal) * 100) / 100,
      utmSource: order.utmSource,
      isDemo: isDemo(order.id) ? "Да" : "Нет",
    };
  });
}

async function clientRows(request: ParsedRequest) {
  const ordersWithinRange = orderWhere(request);
  const clients = await prisma.client.findMany({
    where: {
      ...(request.includeDemo ? {} : { id: { not: { startsWith: "demo-" } } }),
      ...(request.fromDate || request.toDate
        ? { OR: [{ createdAt: dateWhere(request) }, { orders: { some: ordersWithinRange } }] }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      region: true,
      createdAt: true,
      orders: {
        where: ordersWithinRange,
        select: {
          id: true,
          createdAt: true,
          type: true,
          status: true,
          items: { select: { quantity: true, retailPriceAtPurchase: true, distributorPriceAtPurchase: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_EXPORT_ROWS + 1,
  });
  return clients.map((client): Row => {
    const orders = client.orders;
    const completed = orders.filter((order) => order.type === "order" && order.status === "DONE");
    const values = completed.map((order) => completeTotal(order.items, "retail"));
    const retailTotal = values.some((value) => value === null)
      ? null
      : Math.round(values.reduce<number>((sum, value) => sum + (value ?? 0), 0) * 100) / 100;
    const lastOrder = [...orders].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    return {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email,
      region: client.region,
      createdAt: date(client.createdAt),
      orderCount: orders.length,
      doneCount: completed.length,
      retailTotal,
      lastOrderAt: date(lastOrder?.createdAt),
    };
  });
}

async function salesRows(request: ParsedRequest, report: "products" | "regions") {
  const orders = await prisma.order.findMany({
    where: orderWhere(request),
    select: {
      id: true,
      type: true,
      status: true,
      submittedRegion: true,
      items: {
        select: { productSlug: true, quantity: true, retailPriceAtPurchase: true, distributorPriceAtPurchase: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_EXPORT_ROWS + 1,
  });
  if (orders.length > MAX_EXPORT_ROWS) throw new Error("Export exceeds 10000 rows; narrow the period");
  const visible = orders;
  if (report === "regions") {
    const regions = new Map<string, Row>();
    for (const order of visible) {
      const region = order.submittedRegion || "Не указан";
      const current = regions.get(region) ?? { region, orders: 0, completed: 0, retailTotal: 0, missingRetail: 0 };
      current.orders = Number(current.orders) + 1;
      if (order.type === "order" && order.status === "DONE") {
        current.completed = Number(current.completed) + 1;
        const retail = completeTotal(order.items, "retail");
        if (retail === null) current.missingRetail = Number(current.missingRetail) + 1;
        else current.retailTotal = Math.round((Number(current.retailTotal) + retail) * 100) / 100;
      }
      regions.set(region, current);
    }
    return [...regions.values()].sort(
      (left, right) =>
        Number(right.orders) - Number(left.orders) || String(left.region).localeCompare(String(right.region), "ru"),
    );
  }

  const productMap = new Map(products.map((product) => [product.slug, product]));
  const grouped = new Map<string, Row>();
  for (const order of visible) {
    if (order.type !== "order" || order.status !== "DONE") continue;
    const seen = new Set<string>();
    for (const item of order.items) {
      const product = productMap.get(item.productSlug);
      const current = grouped.get(item.productSlug) ?? {
        sku: product?.sku ?? null,
        name: product?.name ?? item.productSlug,
        slug: item.productSlug,
        orderCount: 0,
        units: 0,
        retailTotal: 0,
        distributorTotal: 0,
        margin: null,
        missingRetail: 0,
        missingCost: 0,
      };
      if (!seen.has(item.productSlug)) current.orderCount = Number(current.orderCount) + 1;
      seen.add(item.productSlug);
      current.units = Number(current.units) + item.quantity;
      if (item.retailPriceAtPurchase > 0)
        current.retailTotal =
          Math.round((Number(current.retailTotal) + item.retailPriceAtPurchase * item.quantity) * 100) / 100;
      else current.missingRetail = Number(current.missingRetail) + 1;
      if (item.distributorPriceAtPurchase > 0)
        current.distributorTotal =
          Math.round((Number(current.distributorTotal) + item.distributorPriceAtPurchase * item.quantity) * 100) / 100;
      else current.missingCost = Number(current.missingCost) + 1;
      grouped.set(item.productSlug, current);
    }
  }
  for (const row of grouped.values()) {
    if (Number(row.missingRetail) === 0 && Number(row.missingCost) === 0) {
      row.margin = Math.round((Number(row.retailTotal) - Number(row.distributorTotal)) * 100) / 100;
    } else {
      if (Number(row.missingRetail) > 0) row.retailTotal = null;
      if (Number(row.missingCost) > 0) row.distributorTotal = null;
    }
  }
  return [...grouped.values()].sort(
    (left, right) =>
      Number(right.orderCount) - Number(left.orderCount) || String(left.slug).localeCompare(String(right.slug)),
  );
}

export async function getReportData(request: ParsedRequest) {
  let records: Row[];
  if (request.report === "orders") records = await orderRows(request);
  else if (request.report === "clients") records = await clientRows(request);
  else records = await salesRows(request, request.report);
  if (records.length > MAX_EXPORT_ROWS) throw new Error("Export exceeds 10000 rows; narrow the period");
  return rowValues(request.report, request.columns, records);
}
