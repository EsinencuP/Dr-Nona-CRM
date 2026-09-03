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
    })),
    saveMessageId: vi.fn(async () => undefined),
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
    deps.saveApplication = vi.fn(async () => ({ success: false as const, error: "database unavailable" }));

    const result = await processApplication(input, deps);

    expect(result).toMatchObject({ outcome: "failure", delivery: { telegram: "failed" } });
    expect(deps.sendTelegram).not.toHaveBeenCalled();
    expect(deps.saveMessageId).not.toHaveBeenCalled();
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
    );
  });
});
