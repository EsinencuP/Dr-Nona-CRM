import type { OrderStatus, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "../../src/lib/prisma";

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["DELIVERY", "DONE", "CANCELLED"],
  DELIVERY: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export type OrderStatusTransitionResult =
  | { outcome: "updated"; orderId: string; previousStatus: OrderStatus; status: OrderStatus }
  | { outcome: "unchanged"; orderId: string; previousStatus: OrderStatus; status: OrderStatus }
  | { outcome: "not_found" }
  | { outcome: "invalid_transition"; orderId: string; previousStatus: OrderStatus; status: OrderStatus }
  | { outcome: "conflict"; orderId: string; previousStatus: OrderStatus; status: OrderStatus };

type TransitionInput = {
  orderId?: string;
  telegramMessageId?: string;
  nextStatus: OrderStatus;
  source: "crm" | "telegram_reply" | "telegram_command";
  actorKey: string;
  now?: Date;
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus) {
  return from === to || ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export async function transitionOrderStatus(
  input: TransitionInput,
  db: PrismaClient = getPrismaClient(),
): Promise<OrderStatusTransitionResult> {
  if (!input.orderId && !input.telegramMessageId) return { outcome: "not_found" };
  const now = input.now ?? new Date();
  return db.$transaction(async (transaction) => {
    const order = input.orderId
      ? await transaction.order.findUnique({ where: { id: input.orderId }, select: { id: true, status: true } })
      : await transaction.order.findUnique({
          where: { telegramMessageId: input.telegramMessageId },
          select: { id: true, status: true },
        });
    if (!order) return { outcome: "not_found" } as const;
    if (order.status === input.nextStatus) {
      return {
        outcome: "unchanged",
        orderId: order.id,
        previousStatus: order.status,
        status: order.status,
      } as const;
    }
    if (!canTransitionOrderStatus(order.status, input.nextStatus)) {
      return {
        outcome: "invalid_transition",
        orderId: order.id,
        previousStatus: order.status,
        status: input.nextStatus,
      } as const;
    }
    const updated = await transaction.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status: input.nextStatus,
        ...(order.status === "NEW" ? { firstActionAt: now } : {}),
      },
    });
    if (updated.count !== 1) {
      return {
        outcome: "conflict",
        orderId: order.id,
        previousStatus: order.status,
        status: input.nextStatus,
      } as const;
    }
    await transaction.orderStatusAudit.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: input.nextStatus,
        source: input.source,
        actorKey: input.actorKey.slice(0, 160),
        createdAt: now,
      },
    });
    return {
      outcome: "updated",
      orderId: order.id,
      previousStatus: order.status,
      status: input.nextStatus,
    } as const;
  });
}

export function transitionSucceeded(result: OrderStatusTransitionResult) {
  return result.outcome === "updated" || result.outcome === "unchanged";
}
