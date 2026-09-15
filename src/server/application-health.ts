import { ApplicationSubmissionState } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { requireCrmAccess } from "./crm-auth";

const HEALTH_WINDOW_MINUTES = 15;
const STALE_DELIVERY_MINUTES = 2;
const FAILURE_ALERT_THRESHOLD = 3;

export type ApplicationDeliveryRecord = {
  requestId: string;
  state: ApplicationSubmissionState;
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
  consecutiveFailures: number | null;
  checkedAt: string;
};

export function summarizeApplicationHealth(
  records: ApplicationDeliveryRecord[],
  now: Date,
): Omit<ApplicationHealth, "database" | "checkedAt"> {
  const staleBefore = now.getTime() - STALE_DELIVERY_MINUTES * 60_000;
  const recent = [...records].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const deliveryFailures = recent.filter(
    (record) => record.state === ApplicationSubmissionState.DELIVERY_FAILED,
  ).length;
  const staleDeliveries = recent.filter(
    (record) =>
      record.state === ApplicationSubmissionState.DELIVERY_STARTED && record.updatedAt.getTime() <= staleBefore,
  ).length;
  let consecutiveFailures = 0;
  for (const record of recent) {
    if (record.state === ApplicationSubmissionState.DELIVERED) break;
    if (
      record.state === ApplicationSubmissionState.DELIVERY_FAILED ||
      (record.state === ApplicationSubmissionState.DELIVERY_STARTED && record.updatedAt.getTime() <= staleBefore)
    ) {
      consecutiveFailures += 1;
    }
  }

  return {
    status: consecutiveFailures >= FAILURE_ALERT_THRESHOLD || staleDeliveries > 0 ? "attention" : "healthy",
    windowMinutes: HEALTH_WINDOW_MINUTES,
    failureThreshold: FAILURE_ALERT_THRESHOLD,
    deliveryFailures,
    staleDeliveries,
    consecutiveFailures,
  };
}

type HealthDependencies = {
  authorize?: typeof requireCrmAccess;
  now?: () => Date;
  findRecords?: (windowStart: Date, staleBefore: Date) => Promise<ApplicationDeliveryRecord[]>;
};

async function findApplicationDeliveryRecords(windowStart: Date, staleBefore: Date) {
  return prisma.applicationSubmission.findMany({
    where: {
      OR: [
        { updatedAt: { gte: windowStart } },
        { state: ApplicationSubmissionState.DELIVERY_STARTED, updatedAt: { lte: staleBefore } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { requestId: "desc" }],
    take: 100,
    select: { requestId: true, state: true, updatedAt: true, lastErrorCode: true },
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
        consecutiveFailures: null,
        checkedAt: now.toISOString(),
      };
    }
  };
}

export const getApplicationHealth = createGetApplicationHealth();
