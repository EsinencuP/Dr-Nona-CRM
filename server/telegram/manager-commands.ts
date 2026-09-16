import type { PrismaClient } from "@prisma/client";

import { getPrismaClient } from "../../src/lib/prisma";
import { createPrismaRateLimitIncrement } from "../http/application-rate-limit";
import { createHash, createHmac } from "node:crypto";

const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;

export function telegramActorKey(senderId: string, secret: string) {
  return createHmac("sha256", secret).update(`telegram-manager:${senderId}`).digest("base64url");
}

export async function consumeTelegramCommandRateLimit(
  actorKey: string,
  options: { now?: Date; db?: PrismaClient } = {},
) {
  const now = options.now ?? new Date();
  const windowStartMs = Math.floor(now.getTime() / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + RATE_WINDOW_MS * 2);
  const id = createHash("sha256").update(`telegram-command:${actorKey}:${windowStartMs}`).digest("base64url");
  const attempts = await createPrismaRateLimitIncrement(options.db ?? getPrismaClient())({
    id,
    clientKey: `telegram:${actorKey}`,
    windowStart,
    expiresAt,
    now,
  });
  return attempts <= RATE_LIMIT;
}

export async function reserveTelegramCommandAudit(
  input: { updateId: string; actorKey: string; command: string },
  db: PrismaClient = getPrismaClient(),
) {
  try {
    await db.telegramCommandAudit.create({
      data: {
        updateId: input.updateId,
        actorKey: input.actorKey,
        command: input.command.slice(0, 80),
        outcome: "RECEIVED",
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function completeTelegramCommandAudit(
  updateId: string,
  outcome: string,
  orderId?: string,
  db: PrismaClient = getPrismaClient(),
) {
  await db.telegramCommandAudit.updateMany({
    where: { updateId },
    data: { outcome: outcome.slice(0, 80), orderId: orderId ?? null },
  });
}

export async function getRedactedOrderSummary(orderId: string, db: PrismaClient = getPrismaClient()) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
      items: { select: { productSlug: true, quantity: true } },
    },
  });
  if (!order) return null;
  const items = order.items.length
    ? order.items.map((item) => `${item.productSlug} ×${item.quantity}`).join(", ")
    : "без товаров";
  return [
    `Заявка #${order.id}`,
    `Тип: ${order.type}`,
    `Статус: ${order.status}`,
    `Создана: ${order.createdAt.toISOString()}`,
    `Состав: ${items}`,
  ].join("\n");
}

export async function getOverdueOrderSummary(now = new Date(), slaMinutes = 60, db: PrismaClient = getPrismaClient()) {
  const threshold = new Date(now.getTime() - slaMinutes * 60_000);
  const [count, orders] = await db.$transaction([
    db.order.count({ where: { status: "NEW", createdAt: { lte: threshold } } }),
    db.order.findMany({
      where: { status: "NEW", createdAt: { lte: threshold } },
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 5,
    }),
  ]);
  const lines = orders.map(
    (order) => `#${order.id} · ${Math.floor((now.getTime() - order.createdAt.getTime()) / 60_000)} мин`,
  );
  return [`Просрочено NEW: ${count} (SLA ${slaMinutes} мин)`, ...lines].join("\n");
}

export const TELEGRAM_MANAGER_HELP = [
  "Команды Dr. Nona CRM:",
  "/status processing|delivery|done|cancelled — ответом на карточку заявки",
  "/order <полный ID> — обезличенная сводка",
  "/overdue — просроченные NEW по SLA 60 минут",
  "/help — эта справка",
].join("\n");
