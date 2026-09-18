import type { PrismaClient } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";

import {
  processStatusNotification,
  readNotificationConfiguration,
  sendSmsMd,
} from "../../server/notifications/customer-status-notifications";

const approvedTestEnvironment = {
  CUSTOMER_STATUS_NOTIFICATIONS_ENABLED: "true",
  CUSTOMER_STATUS_NOTIFICATION_LEGAL_BASIS: "transactional_status",
  CUSTOMER_STATUS_QUIET_HOURS: "20-09",
  CUSTOMER_STATUS_TEMPLATE_PROCESSING_RU: "Заявка {requestId} обрабатывается.",
  CUSTOMER_STATUS_TEMPLATE_PROCESSING_RO: "Solicitarea {requestId} este procesată.",
  SMS_MD_API_TOKEN: "test-token",
  SMS_MD_SENDER: "DrNona",
};

describe("customer status notifications", () => {
  test("fails closed until every approval and provider setting exists", () => {
    expect(readNotificationConfiguration({})).toMatchObject({
      enabled: false,
      reasons: expect.arrayContaining(["disabled", "legal_basis_unapproved", "templates_unapproved"]),
    });
  });

  test("accepts only the complete approved configuration", () => {
    expect(
      readNotificationConfiguration({
        CUSTOMER_STATUS_NOTIFICATIONS_ENABLED: "true",
        CUSTOMER_STATUS_NOTIFICATION_LEGAL_BASIS: "transactional_status",
        CUSTOMER_STATUS_QUIET_HOURS: "20-09",
        CUSTOMER_STATUS_TEMPLATE_PROCESSING_RU: "Заявка {requestId} обрабатывается.",
        CUSTOMER_STATUS_TEMPLATE_PROCESSING_RO: "Solicitarea {requestId} este procesată.",
        SMS_MD_API_TOKEN: "token",
        SMS_MD_SENDER: "DrNona",
      }),
    ).toMatchObject({ enabled: true, quietStart: 20, quietEnd: 9 });
  });

  test("records SMS.MD provider id and cost", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ id: "sms-1", status: "queued", cost: "0.30", currency: "MDL" }),
    ) as typeof fetch;
    await expect(
      sendSmsMd({ to: "+37369123456", from: "DrNona", text: "Test", apiToken: "secret" }, fetchImpl),
    ).resolves.toEqual({ ok: true, providerMessageId: "sms-1", cost: 0.3, currency: "MDL" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.sms.md/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
  });

  test("records provider acceptance only once, without claiming handset delivery", async () => {
    let state = "PENDING";
    const fetchImpl = vi.fn(async () => Response.json({ id: "sms-1", status: "queued" })) as typeof fetch;
    const db = {
      order: {
        findUnique: vi.fn(async () => ({
          id: "test-order",
          locale: "ro-MD",
          client: { phoneNormalized: "+37369123456", customerNotificationsOptOutAt: null },
        })),
      },
      customerNotification: {
        upsert: vi.fn(async () => ({ id: "test-notification", state })),
        updateMany: vi.fn(async () => ({ count: state === "PENDING" ? 1 : 0 })),
        update: vi.fn(async ({ data }: { data: { state: string } }) => {
          state = data.state;
          return { id: "test-notification", state };
        }),
      },
    } as unknown as PrismaClient;
    const options = { env: approvedTestEnvironment, now: new Date("2026-09-18T10:00:00Z"), fetch: fetchImpl };
    await expect(processStatusNotification("test-order", "PROCESSING", db, options)).resolves.toMatchObject({
      outcome: "accepted",
    });
    await expect(processStatusNotification("test-order", "PROCESSING", db, options)).resolves.toMatchObject({
      outcome: "already_accepted",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  test("does not send after opt-out or without activation", async () => {
    const findUnique = vi.fn(async () => ({
      id: "test-order",
      locale: "ru-MD",
      client: { phoneNormalized: "+37369123456", customerNotificationsOptOutAt: new Date() },
    }));
    const db = { order: { findUnique } } as unknown as PrismaClient;
    const fetchImpl = vi.fn() as typeof fetch;
    await expect(
      processStatusNotification("test-order", "PROCESSING", db, { env: {}, fetch: fetchImpl }),
    ).resolves.toMatchObject({
      outcome: "blocked",
    });
    expect(findUnique).not.toHaveBeenCalled();
    await expect(
      processStatusNotification("test-order", "PROCESSING", db, { env: approvedTestEnvironment, fetch: fetchImpl }),
    ).resolves.toMatchObject({
      outcome: "opted_out",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("holds uncertain network outcomes for review instead of resending", async () => {
    let state = "PENDING";
    const fetchImpl = vi.fn(async () => {
      throw new Error("timeout");
    }) as typeof fetch;
    const db = {
      order: {
        findUnique: vi.fn(async () => ({
          id: "test-order",
          locale: "ru-MD",
          client: { phoneNormalized: "+37369123456", customerNotificationsOptOutAt: null },
        })),
      },
      customerNotification: {
        upsert: vi.fn(async () => ({ id: "test-notification", state })),
        updateMany: vi.fn(async () => ({ count: state === "PENDING" ? 1 : 0 })),
        update: vi.fn(async ({ data }: { data: { state: string } }) => {
          state = data.state;
          return { id: "test-notification", state };
        }),
      },
    } as unknown as PrismaClient;
    const options = { env: approvedTestEnvironment, now: new Date("2026-09-18T10:00:00Z"), fetch: fetchImpl };
    await expect(processStatusNotification("test-order", "PROCESSING", db, options)).resolves.toMatchObject({
      outcome: "needs_review",
    });
    await expect(processStatusNotification("test-order", "PROCESSING", db, options)).resolves.toMatchObject({
      outcome: "needs_review",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
