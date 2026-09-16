import { TelegramOutboxState } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { requireCrmAccess } from "./crm-auth";

const HEALTH_WINDOW_MINUTES = 15;
const STALE_DELIVERY_MINUTES = 5;
const FAILURE_ALERT_THRESHOLD = 1;

export type ApplicationDeliveryRecord = {
  orderId: string;
  state: TelegramOutboxState;
  updatedAt: Date;
  lastErrorCode: string | null;
};

export type ApplicationHealth = {
  status: "healthy" | "attention";
  database: "reachable" | "unavailable";
  windowMinutes: number;
  failureThreshold: number;
  deliveryFailures: number | null;
  staleDeliveries: number | null;
  pendingRetries: number | null;
  needsReview: number | null;
  consecutiveFailures: number | null;
  checkedAt: string;
};

export function summarizeApplicationHealth(
  records: ApplicationDeliveryRecord[],
  now: Date,
): Omit<ApplicationHealth, "database" | "checkedAt"> {
  const staleBefore = now.getTime() - STALE_DELIVERY_MINUTES * 60_000;
  const recent = [...records].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const deliveryFailures = recent.filter((record) => record.state === TelegramOutboxState.TERMINAL).length;
  const needsReview = recent.filter((record) => record.state === TelegramOutboxState.NEEDS_REVIEW).length;
  const pendingRetries = recent.filter((record) => record.state === TelegramOutboxState.PENDING).length;
  const staleDeliveries = recent.filter(
    (record) => record.state === TelegramOutboxState.SENDING && record.updatedAt.getTime() <= staleBefore,
  ).length;
  let consecutiveFailures = 0;
  for (const record of recent) {
    if (record.state === TelegramOutboxState.DELIVERED) break;
    if (
      record.state === TelegramOutboxState.TERMINAL ||
      record.state === TelegramOutboxState.NEEDS_REVIEW ||
      (record.state === TelegramOutboxState.SENDING && record.updatedAt.getTime() <= staleBefore)
    ) {
      consecutiveFailures += 1;
    }
  }

  return {
    status: deliveryFailures > 0 || needsReview > 0 || staleDeliveries > 0 ? "attention" : "healthy",
    windowMinutes: HEALTH_WINDOW_MINUTES,
    failureThreshold: FAILURE_ALERT_THRESHOLD,
    deliveryFailures,
    staleDeliveries,
    pendingRetries,
    needsReview,
    consecutiveFailures,
  };
}

type HealthDependencies = {
  authorize?: typeof requireCrmAccess;
  now?: () => Date;
  findRecords?: (windowStart: Date, staleBefore: Date) => Promise<ApplicationDeliveryRecord[]>;
};

async function findApplicationDeliveryRecords(windowStart: Date, staleBefore: Date) {
  return prisma.telegramOutbox.findMany({
    where: {
      OR: [
        { updatedAt: { gte: windowStart } },
        { state: TelegramOutboxState.SENDING, updatedAt: { lte: staleBefore } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { orderId: "desc" }],
    take: 100,
    select: { orderId: true, state: true, updatedAt: true, lastErrorCode: true },
  });
}

export function createGetApplicationHealth(dependencies: HealthDependencies = {}) {
  return async function getApplicationHealth(): Promise<ApplicationHealth> {
    await (dependencies.authorize ?? requireCrmAccess)();
    const now = (dependencies.now ?? (() => new Date()))();
    const windowStart = new Date(now.getTime() - HEALTH_WINDOW_MINUTES * 60_000);
    const staleBefore = new Date(now.getTime() - STALE_DELIVERY_MINUTES * 60_000);
    try {
      const records = await (dependencies.findRecords ?? findApplicationDeliveryRecords)(windowStart, staleBefore);
      return {
        ...summarizeApplicationHealth(records, now),
        database: "reachable",
        checkedAt: now.toISOString(),
      };
    } catch {
      return {
        status: "attention",
        database: "unavailable",
        windowMinutes: HEALTH_WINDOW_MINUTES,
        failureThreshold: FAILURE_ALERT_THRESHOLD,
        deliveryFailures: null,
        staleDeliveries: null,
        pendingRetries: null,
        needsReview: null,
        consecutiveFailures: null,
        checkedAt: now.toISOString(),
      };
    }
  };
}

export const getApplicationHealth = createGetApplicationHealth();
