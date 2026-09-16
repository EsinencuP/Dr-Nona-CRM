import { ApplicationSubmissionState, type PrismaClient, TelegramOutboxState } from "@prisma/client";

import { getPrismaClient } from "../../src/lib/prisma";
import type { ProviderResult } from "./application-types";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000] as const;
const STALE_LOCK_MS = 5 * 60_000;
const UNCERTAIN_ERROR_CODES = new Set(["NETWORK_ERROR", "TIMEOUT", "DELIVERY_STATE_PERSISTENCE"]);

export type OutboxDeliveryResult = {
  orderId: string;
  delivery: "sent" | "pending" | "failed";
  state: TelegramOutboxState;
  attempts: number;
};

export type TelegramPayloadSender = (payload: string) => Promise<ProviderResult>;

function isRetryable(errorCode: string) {
  return errorCode === "RATE_LIMITED" || /^HTTP_5\d\d$/u.test(errorCode) || errorCode === "PROVIDER_UNAVAILABLE";
}

export async function markStaleTelegramOutboxForReview(now = new Date(), db: PrismaClient = getPrismaClient()) {
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  return db.telegramOutbox.updateMany({
    where: { state: TelegramOutboxState.SENDING, lockedAt: { lte: staleBefore } },
    data: {
      state: TelegramOutboxState.NEEDS_REVIEW,
      lastErrorCode: "STALE_UNCERTAIN_DELIVERY",
      lockedAt: null,
    },
  });
}

export async function deliverTelegramOutbox(
  orderId: string,
  send: TelegramPayloadSender,
  options: { now?: Date; db?: PrismaClient } = {},
): Promise<OutboxDeliveryResult> {
  const db = options.db ?? getPrismaClient();
  const now = options.now ?? new Date();
  await markStaleTelegramOutboxForReview(now, db);
  const acquired = await db.telegramOutbox.updateMany({
    where: {
      orderId,
      state: TelegramOutboxState.PENDING,
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      state: TelegramOutboxState.SENDING,
      attempts: { increment: 1 },
      lockedAt: now,
      lastAttemptAt: now,
      lastErrorCode: null,
    },
  });
  const current = await db.telegramOutbox.findUnique({ where: { orderId } });
  if (!current) {
    return { orderId, delivery: "failed", state: TelegramOutboxState.TERMINAL, attempts: 0 };
  }
  if (acquired.count !== 1) {
    let delivery: OutboxDeliveryResult["delivery"] = "failed";
    if (current.state === TelegramOutboxState.DELIVERED) delivery = "sent";
    else if (current.state === TelegramOutboxState.PENDING || current.state === TelegramOutboxState.SENDING) {
      delivery = "pending";
    }
    return { orderId, delivery, state: current.state, attempts: current.attempts };
  }

  const result = await send(current.payload).catch(
    (): ProviderResult => ({ provider: "telegram", status: "failed", errorCode: "NETWORK_ERROR", durationMs: 0 }),
  );
  if (result.status === "sent") {
    try {
      await db.$transaction([
        db.order.update({ where: { id: orderId }, data: { telegramMessageId: result.providerMessageId } }),
        db.telegramOutbox.update({
          where: { orderId },
          data: {
            state: TelegramOutboxState.DELIVERED,
            providerMessageId: result.providerMessageId,
            lastErrorCode: null,
            lockedAt: null,
          },
        }),
        db.applicationSubmission.updateMany({
          where: { requestId: orderId },
          data: {
            state: ApplicationSubmissionState.DELIVERED,
            providerMessageId: result.providerMessageId,
            lastErrorCode: null,
          },
        }),
      ]);
      return {
        orderId,
        delivery: "sent",
        state: TelegramOutboxState.DELIVERED,
        attempts: current.attempts,
      };
    } catch {
      await db.telegramOutbox.updateMany({
        where: { orderId, state: TelegramOutboxState.SENDING },
        data: {
          state: TelegramOutboxState.NEEDS_REVIEW,
          lastErrorCode: "DELIVERY_STATE_PERSISTENCE",
          lockedAt: null,
        },
      });
      return {
        orderId,
        delivery: "failed",
        state: TelegramOutboxState.NEEDS_REVIEW,
        attempts: current.attempts,
      };
    }
  }

  const attempts = current.attempts;
  const uncertain = UNCERTAIN_ERROR_CODES.has(result.errorCode);
  const retry = !uncertain && attempts < MAX_ATTEMPTS && isRetryable(result.errorCode);
  let state: TelegramOutboxState = TelegramOutboxState.TERMINAL;
  if (uncertain) state = TelegramOutboxState.NEEDS_REVIEW;
  else if (retry) state = TelegramOutboxState.PENDING;
  const nextAttemptAt = retry
    ? new Date(now.getTime() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)])
    : now;
  await db.$transaction([
    db.telegramOutbox.update({
      where: { orderId },
      data: {
        state,
        nextAttemptAt,
        lastErrorCode: result.errorCode.slice(0, 100),
        lockedAt: null,
      },
    }),
    db.applicationSubmission.updateMany({
      where: { requestId: orderId },
      data: {
        state:
          state === TelegramOutboxState.PENDING
            ? ApplicationSubmissionState.DELIVERY_STARTED
            : ApplicationSubmissionState.DELIVERY_FAILED,
        lastErrorCode: result.errorCode.slice(0, 100),
      },
    }),
  ]);
  return { orderId, delivery: retry ? "pending" : "failed", state, attempts };
}

export async function processDueTelegramOutbox(
  send: TelegramPayloadSender,
  options: { limit?: number; now?: Date; db?: PrismaClient } = {},
) {
  const db = options.db ?? getPrismaClient();
  const now = options.now ?? new Date();
  const due = await db.telegramOutbox.findMany({
    where: { state: TelegramOutboxState.PENDING, nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
    select: { orderId: true },
    orderBy: [{ nextAttemptAt: "asc" }, { orderId: "asc" }],
    take: Math.min(Math.max(options.limit ?? 3, 1), 10),
  });
  const results: OutboxDeliveryResult[] = [];
  for (const entry of due) results.push(await deliverTelegramOutbox(entry.orderId, send, { db, now }));
  return results;
}

export async function rearmTelegramOutbox(orderId: string, db: PrismaClient = getPrismaClient()) {
  const result = await db.telegramOutbox.updateMany({
    where: { orderId, state: { in: [TelegramOutboxState.NEEDS_REVIEW, TelegramOutboxState.TERMINAL] } },
    data: {
      state: TelegramOutboxState.PENDING,
      attempts: 0,
      nextAttemptAt: new Date(),
      lastErrorCode: null,
      lockedAt: null,
    },
  });
  return result.count === 1;
}

export async function cancelTelegramOutbox(orderId: string, db: PrismaClient = getPrismaClient()) {
  const result = await db.telegramOutbox.updateMany({
    where: {
      orderId,
      state: { in: [TelegramOutboxState.PENDING, TelegramOutboxState.NEEDS_REVIEW, TelegramOutboxState.TERMINAL] },
    },
    data: { state: TelegramOutboxState.CANCELLED, lockedAt: null },
  });
  return result.count === 1;
}
