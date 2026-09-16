import { TelegramOutboxState } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";

import {
  type ApplicationDeliveryRecord,
  createGetApplicationHealth,
  summarizeApplicationHealth,
} from "@/server/application-health";

const now = new Date("2026-09-15T12:00:00.000Z");

function record(state: TelegramOutboxState, minutesAgo: number, orderId: string): ApplicationDeliveryRecord {
  return {
    orderId,
    state,
    updatedAt: new Date(now.getTime() - minutesAgo * 60_000),
    lastErrorCode: state === TelegramOutboxState.TERMINAL ? "HTTP_502" : null,
  };
}

describe("application delivery health", () => {
  test("alerts on terminal failures while resetting the consecutive counter after success", () => {
    const failures = [
      record(TelegramOutboxState.TERMINAL, 1, "failed-1"),
      record(TelegramOutboxState.TERMINAL, 2, "failed-2"),
      record(TelegramOutboxState.TERMINAL, 3, "failed-3"),
    ];
    expect(summarizeApplicationHealth(failures, now)).toMatchObject({
      status: "attention",
      consecutiveFailures: 3,
      deliveryFailures: 3,
    });
    expect(
      summarizeApplicationHealth([record(TelegramOutboxState.DELIVERED, 0, "delivered"), ...failures], now),
    ).toMatchObject({ status: "attention", consecutiveFailures: 0, deliveryFailures: 3 });
  });

  test("alerts on one stale unknown delivery without treating a fresh send as failed", () => {
    expect(summarizeApplicationHealth([record(TelegramOutboxState.SENDING, 6, "stale")], now)).toMatchObject({
      status: "attention",
      staleDeliveries: 1,
    });
    expect(summarizeApplicationHealth([record(TelegramOutboxState.PENDING, 10, "scheduled")], now)).toMatchObject({
      status: "healthy",
      staleDeliveries: 0,
    });
  });

  test("authorizes before reading records and fails visibly when the database is unavailable", async () => {
    const authorize = vi.fn(async () => undefined);
    const findRecords = vi.fn(async () => {
      throw new Error("postgresql://secret.example/db");
    });
    const health = await createGetApplicationHealth({ authorize, findRecords, now: () => now })();
    expect(authorize).toHaveBeenCalledOnce();
    expect(findRecords).toHaveBeenCalledOnce();
    expect(health).toMatchObject({ status: "attention", database: "unavailable" });
    expect(JSON.stringify(health)).not.toContain("postgresql://");
  });

  test("does not query health data when authorization fails", async () => {
    const findRecords = vi.fn();
    const getHealth = createGetApplicationHealth({
      authorize: async () => {
        throw new Error("unauthorized");
      },
      findRecords,
      now: () => now,
    });
    await expect(getHealth()).rejects.toThrow("unauthorized");
    expect(findRecords).not.toHaveBeenCalled();
  });
});
