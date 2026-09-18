import { prisma } from "@/lib/prisma";
import type { ApplicationHealth } from "@/server/application-health";
import { getApplicationHealth } from "@/server/application-health";
import { requireCrmAccess } from "@/server/crm-auth";

import { CRM_SLA_MINUTES, CRM_TIMEZONE, getSlaWindows, slaAgeMinutes } from "../../server/operations/sla-policy";

export type CrmStatusLevel = "healthy" | "warning" | "critical" | "unknown";

export type CrmSlaSnapshot = {
  slaMinutes: number;
  timezone: typeof CRM_TIMEZONE;
  checkedAt: string;
  todayCount: number;
  weekCount: number;
  overdueCount: number;
  oldestOverdue: Array<{ id: string; createdAt: string; ageMinutes: number }>;
};

export type CrmStatusSnapshot = {
  level: CrmStatusLevel;
  checkedAt: string;
  refreshAfterSeconds: 60;
  staleAfterSeconds: 150;
  health: ApplicationHealth | null;
  sla: CrmSlaSnapshot | null;
  unavailableChecks: Array<"delivery" | "sla">;
};

export function deriveCrmStatusLevel(health: ApplicationHealth | null, sla: CrmSlaSnapshot | null): CrmStatusLevel {
  if (!health || !sla) return "unknown";
  if (
    health.database === "unavailable" ||
    health.status === "attention" ||
    (health.deliveryFailures ?? 0) > 0 ||
    (health.staleDeliveries ?? 0) > 0 ||
    (health.needsReview ?? 0) > 0
  ) {
    return "critical";
  }
  if ((health.pendingRetries ?? 0) > 0 || sla.overdueCount > 0) return "warning";
  return "healthy";
}

async function readSlaSnapshot(now: Date): Promise<CrmSlaSnapshot> {
  const { todayStart, weekStart, overdueBefore } = getSlaWindows(now);
  const [todayCount, weekCount, overdueCount, oldestOverdue] = await prisma.$transaction(
    [
      prisma.order.count({ where: { createdAt: { gte: todayStart, lt: now } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart, lt: now } } }),
      prisma.order.count({ where: { status: "NEW", createdAt: { lte: overdueBefore } } }),
      prisma.order.findMany({
        where: { status: "NEW", createdAt: { lte: overdueBefore } },
        select: { id: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 5,
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    slaMinutes: CRM_SLA_MINUTES,
    timezone: CRM_TIMEZONE,
    checkedAt: now.toISOString(),
    todayCount,
    weekCount,
    overdueCount,
    oldestOverdue: oldestOverdue.map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      ageMinutes: slaAgeMinutes(order.createdAt, now),
    })),
  };
}

type CrmStatusDependencies = {
  authorize?: typeof requireCrmAccess;
  now?: () => Date;
  getHealth?: () => Promise<ApplicationHealth>;
  getSla?: (now: Date) => Promise<CrmSlaSnapshot>;
};

export function createGetCrmStatusSnapshot(dependencies: CrmStatusDependencies = {}) {
  return async function getCrmStatusSnapshot(): Promise<CrmStatusSnapshot> {
    await (dependencies.authorize ?? requireCrmAccess)();
    const now = (dependencies.now ?? (() => new Date()))();
    const [healthResult, slaResult] = await Promise.allSettled([
      (dependencies.getHealth ?? getApplicationHealth)(),
      (dependencies.getSla ?? readSlaSnapshot)(now),
    ]);
    const health = healthResult.status === "fulfilled" ? healthResult.value : null;
    const sla = slaResult.status === "fulfilled" ? slaResult.value : null;
    const unavailableChecks: CrmStatusSnapshot["unavailableChecks"] = [];
    if (!health) unavailableChecks.push("delivery");
    if (!sla) unavailableChecks.push("sla");
    return {
      level: deriveCrmStatusLevel(health, sla),
      checkedAt: now.toISOString(),
      refreshAfterSeconds: 60,
      staleAfterSeconds: 150,
      health,
      sla,
      unavailableChecks,
    };
  };
}

export const getCrmStatusSnapshot = createGetCrmStatusSnapshot();
