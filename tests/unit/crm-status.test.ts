import { describe, expect, test, vi } from "vitest";

import type { ApplicationHealth } from "@/server/application-health";
import { type CrmSlaSnapshot, createGetCrmStatusSnapshot, deriveCrmStatusLevel } from "@/server/crm-status";

const checkedAt = "2026-09-18T10:00:00.000Z";

function health(overrides: Partial<ApplicationHealth> = {}): ApplicationHealth {
  return {
    status: "healthy",
    database: "reachable",
    windowMinutes: 15,
    failureThreshold: 1,
    deliveryFailures: 0,
    staleDeliveries: 0,
    pendingRetries: 0,
    needsReview: 0,
    consecutiveFailures: 0,
    checkedAt,
    ...overrides,
  };
}

function sla(overrides: Partial<CrmSlaSnapshot> = {}): CrmSlaSnapshot {
  return {
    slaMinutes: 60,
    timezone: "Europe/Chisinau",
    checkedAt,
    todayCount: 2,
    weekCount: 8,
    overdueCount: 0,
    oldestOverdue: [],
    ...overrides,
  };
}

describe("CRM global status", () => {
  test("derives confirmed severity without treating incomplete checks as system failure", () => {
    expect(deriveCrmStatusLevel(health(), sla())).toBe("healthy");
    expect(deriveCrmStatusLevel(health({ pendingRetries: 1 }), sla())).toBe("warning");
    expect(deriveCrmStatusLevel(health(), sla({ overdueCount: 2 }))).toBe("warning");
    expect(deriveCrmStatusLevel(health({ status: "attention", needsReview: 1 }), sla())).toBe("critical");
    expect(deriveCrmStatusLevel(health({ database: "unavailable" }), sla())).toBe("critical");
    expect(deriveCrmStatusLevel(null, sla())).toBe("unknown");
    expect(deriveCrmStatusLevel(health(), null)).toBe("unknown");
  });

  test("authorizes and returns a serializable healthy snapshot", async () => {
    const authorize = vi.fn().mockResolvedValue(undefined);
    const getSnapshot = createGetCrmStatusSnapshot({
      authorize,
      now: () => new Date(checkedAt),
      getHealth: async () => health(),
      getSla: async () => sla(),
    });

    await expect(getSnapshot()).resolves.toEqual({
      level: "healthy",
      checkedAt,
      refreshAfterSeconds: 60,
      staleAfterSeconds: 150,
      health: health(),
      sla: sla(),
      unavailableChecks: [],
    });
    expect(authorize).toHaveBeenCalledOnce();
  });

  test("keeps the available result and marks a failed check as unknown", async () => {
    const getSnapshot = createGetCrmStatusSnapshot({
      authorize: vi.fn().mockResolvedValue(undefined),
      now: () => new Date(checkedAt),
      getHealth: async () => health(),
      getSla: async () => {
        throw new Error("database unavailable");
      },
    });

    await expect(getSnapshot()).resolves.toMatchObject({
      level: "unknown",
      health: health(),
      sla: null,
      unavailableChecks: ["sla"],
    });
  });
});
