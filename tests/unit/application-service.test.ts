import { describe, expect, test, vi } from "vitest";

import { type ApplicationServiceDependencies, processApplication } from "../../server/applications/application-service";
import type { ProviderResult } from "../../server/applications/application-types";
import type { ApplicationInput } from "../../shared/applications/application-schema";
import { MASTERCLASS_TOPICS } from "../../shared/constants/masterclass-topics";

const input: ApplicationInput = {
  locale: "ru-MD",
  type: "order",
  firstName: "Ana",
  lastName: "Popescu",
  phone: "069 123 456",
  city: "Кишинёв",
  consentAccepted: true,
  website: "",
  productSlugs: ["lord-deodorant"],
};
const sent = (): ProviderResult => ({
  provider: "telegram",
  status: "sent",
  providerMessageId: "telegram-id",
  durationMs: 1,
});
const failed = (): ProviderResult => ({
  provider: "telegram",
  status: "failed",
  errorCode: "TEST",
  durationMs: 1,
});

function dependencies(telegram: () => Promise<ProviderResult>) {
  return {
    productsBySlug: new Map([
      [
        "lord-deodorant",
        {
          slug: "lord-deodorant",
          officialName: "Lord Deodorant",
          sku: "324001",
        },
      ],
    ]),
    sendTelegram: vi.fn(telegram),
    createRequestId: () => "request-fixed",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    logger: vi.fn(),
    saveApplication: vi.fn<NonNullable<ApplicationServiceDependencies["saveApplication"]>>(async () => ({
      success: true as const,
      orderId: "request-fixed",
      disposition: "created" as const,
    })),
    completeDelivery: vi.fn(async () => true),
    markDeliveryFailed: vi.fn(async () => true),
  };
}

describe("application service", () => {
  test.each([
    ["success", () => Promise.resolve(sent())],
    ["failure", () => Promise.resolve(failed())],
    ["failure", () => Promise.reject(new Error("provider failed"))],
  ])("returns %s for Telegram result", async (outcome, telegram) => {
    const result = await processApplication(input, dependencies(telegram));
    expect(result.outcome).toBe(outcome);
  });

  test("does not send Telegram or report success when persistence fails", async () => {
    const deps = dependencies(() => Promise.resolve(sent()));
    deps.saveApplication = vi.fn(async () => ({
      success: false as const,
      disposition: "failure" as const,
      error: "database unavailable",
    }));

    const result = await processApplication(input, deps);

    expect(result).toMatchObject({ outcome: "failure", delivery: { telegram: "failed" } });
    expect(deps.sendTelegram).not.toHaveBeenCalled();
    expect(deps.completeDelivery).not.toHaveBeenCalled();
  });

  test("uses the server request ID in the Telegram message", async () => {
    const deps = dependencies(() => Promise.resolve(sent()));
    await processApplication(input, deps);
    const telegramCalls = deps.sendTelegram.mock.calls as unknown as [unknown, string][];
    expect(telegramCalls[0][1]).toContain("request-fixed");
  });

  test("passes selected quantities to the record and Telegram message", async () => {
    const deps = dependencies(() => Promise.resolve(sent()));
    await processApplication(
      {
        ...input,
        items: [{ slug: "lord-deodorant", quantity: 4 }],
      },
      deps,
    );
    const [record, message] = deps.sendTelegram.mock.calls[0] as unknown as [
      { products: Array<{ slug: string; quantity?: number }> },
      string,
    ];

    expect(record.products).toEqual([expect.objectContaining({ slug: "lord-deodorant", quantity: 4 })]);
    expect(message).toContain("Lord Deodorant × 4 шт.");
  });

  test("makes the temporary productSlugs-only quantity fallback observable", async () => {
    const deps = dependencies(() => Promise.resolve(sent()));
    await processApplication(input, deps);

    expect(deps.logger).toHaveBeenCalledWith({
      event: "application.contract.legacy_order_items",
      requestId: "request-fixed",
      fallbackQuantity: 1,
    });
    expect(deps.saveApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        products: [{ slug: "lord-deodorant", quantity: 1 }],
      }),
      undefined,
      undefined,
    );
  });

  test.each([
    ["ru-MD", "Язык: RU"],
    ["ro-MD", "Язык: RO"],
  ] as const)("preserves %s from validated input through Telegram", async (locale, label) => {
    const deps = dependencies(() => Promise.resolve(sent()));
    await processApplication({ ...input, locale }, deps);
    const [record, message] = deps.sendTelegram.mock.calls[0] as unknown as [{ locale: string }, string];
    expect(record.locale).toBe(locale);
    expect(message).toContain(label);
  });

  test("maps a masterclass to Telegram and database fields", async () => {
    const deps = dependencies(() => Promise.resolve(sent()));
    const masterclassInput: ApplicationInput = {
      ...input,
      type: "masterclass",
      masterclassTopic: MASTERCLASS_TOPICS[0],
      eventDate: "2030-06-20",
      eventTime: "14:30",
    };

    const result = await processApplication(masterclassInput, deps);

    expect(result).toMatchObject({ type: "masterclass", outcome: "success" });
    expect(deps.sendTelegram).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "masterclass",
        masterclassTopic: MASTERCLASS_TOPICS[0],
        eventDate: "2030-06-20",
        eventTime: "14:30",
        timezone: "Europe/Chisinau",
      }),
      expect.stringContaining("🎓 НОВАЯ ЗАПИСЬ НА МАСТЕР-КЛАСС"),
    );
    expect(deps.saveApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "masterclass",
        masterclassTopic: MASTERCLASS_TOPICS[0],
        eventDate: "2030-06-20",
        eventTime: "14:30",
        products: undefined,
      }),
      undefined,
      undefined,
    );
  });

  test("replays a completed key without creating or sending again", async () => {
    const deps = dependencies(() => Promise.resolve(sent()));
    deps.saveApplication = vi.fn(async () => ({
      success: true as const,
      orderId: "original-request",
      disposition: "replay" as const,
    }));

    const result = await processApplication(input, deps, { idempotencyKey: "same-key" });

    expect(result).toMatchObject({ outcome: "success", requestId: "original-request", replayed: true });
    expect(deps.sendTelegram).not.toHaveBeenCalled();
    expect(deps.completeDelivery).not.toHaveBeenCalled();
  });

  test.each([
    ["in_progress", "in_progress"],
    ["conflict", "conflict"],
  ] as const)("returns %s without Telegram for a persistent %s decision", async (disposition, outcome) => {
    const deps = dependencies(() => Promise.resolve(sent()));
    deps.saveApplication = vi.fn(async () =>
      disposition === "conflict"
        ? { success: false as const, disposition, error: "IDEMPOTENCY_CONFLICT" }
        : { success: true as const, orderId: "original-request", disposition },
    );

    const result = await processApplication(input, deps, { idempotencyKey: "same-key" });

    expect(result.outcome).toBe(outcome);
    expect(deps.sendTelegram).not.toHaveBeenCalled();
  });

  test("retries a definite delivery failure with the original request ID", async () => {
    const deps = dependencies(() => Promise.resolve(sent()));
    deps.saveApplication = vi.fn(async () => ({
      success: true as const,
      orderId: "original-request",
      disposition: "retry" as const,
    }));

    const result = await processApplication(input, deps, { idempotencyKey: "same-key" });

    expect(result).toMatchObject({ outcome: "success", requestId: "original-request" });
    expect(deps.sendTelegram).toHaveBeenCalledOnce();
    expect(deps.sendTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "original-request" }),
      expect.stringContaining("original-request"),
    );
    expect(deps.completeDelivery).toHaveBeenCalledWith("original-request", "telegram-id");
  });
});
