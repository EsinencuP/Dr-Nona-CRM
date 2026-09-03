import { describe, expect, test, vi } from "vitest";

import { type ApplicationsHandlerDependencies, createApplicationsHandler } from "../../api/applications";
import type { ApplicationServiceResult } from "../../server/applications/application-types";
import type { ContactEnvironment } from "../../server/config/contact-env";
import { createApplicationRateLimitGuard } from "../../server/http/application-rate-limit";
import { MASTERCLASS_TOPICS } from "../../shared/constants/masterclass-topics";

const environment: ContactEnvironment = {
  allowedOrigins: new Set(["https://example.test"]),
  telegramBotToken: "test-token",
  telegramChatId: "test-chat",
};
const validBody = {
  locale: "ru-MD",
  type: "order",
  firstName: "Ana",
  lastName: "Popescu",
  phone: "069 123 456",
  city: "Кишинёв",
  consentAccepted: true,
  website: "",
  productSlugs: ["lord-deodorant"],
  items: [{ slug: "lord-deodorant", quantity: 2 }],
};
const request = (body: unknown = validBody, overrides: { method?: string; headers?: Record<string, string> } = {}) =>
  new Request("https://example.test/api/applications", {
    method: overrides.method ?? "POST",
    headers: {
      Origin: "https://example.test",
      "Content-Type": "application/json",
      "Idempotency-Key": "attempt-1",
      ...overrides.headers,
    },
    ...(overrides.method === "GET" ? {} : { body: JSON.stringify(body) }),
  });

function handler(serviceResult: ApplicationServiceResult, overrides: ApplicationsHandlerDependencies = {}) {
  return createApplicationsHandler({
    environment: () => ({ success: true, value: environment }),
    process: vi.fn(async () => serviceResult),
    rateLimitGuard: async () => true,
    ...overrides,
  });
}

describe("POST /api/applications", () => {
  test.each(["ru-MD", "ro-MD"] as const)(
    "passes validated locale %s unchanged to the application service",
    async (locale) => {
      const process = vi.fn(async () => ({
        requestId: "request-locale",
        type: "order" as const,
        delivery: { telegram: "sent" as const },
        outcome: "success" as const,
      }));
      const response = await handler(
        {
          requestId: "request-locale",
          type: "order",
          delivery: { telegram: "sent" },
          outcome: "success",
        },
        { process },
      )(request({ ...validBody, locale }));

      expect(response.status).toBe(201);
      expect(process).toHaveBeenCalledWith(expect.objectContaining({ locale }), expect.any(Object));
    },
  );

  test.each([
    [
      201,
      {
        requestId: "request-1",
        type: "order" as const,
        delivery: { telegram: "sent" as const },
        outcome: "success" as const,
      },
    ],
    [
      502,
      {
        requestId: "request-3",
        type: "order" as const,
        delivery: { telegram: "failed" as const },
        outcome: "failure" as const,
      },
    ],
  ])("returns delivery status %s without provider details", async (status, result) => {
    const response = await handler(result)(request());
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const text = await response.text();
    expect(text).not.toMatch(/test-token|test-chat/u);
  });

  test("returns 400 for invalid input", async () => {
    const response = await handler({
      requestId: "unused",
      type: "order",
      delivery: { telegram: "sent" },
      outcome: "success",
    })(request({ ...validBody, phone: "bad" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { phone: expect.any(String) },
    });
  });

  test("accepts and forwards a valid masterclass application", async () => {
    const process = vi.fn(async () => ({
      requestId: "request-masterclass",
      type: "masterclass" as const,
      delivery: { telegram: "sent" as const },
      outcome: "success" as const,
    }));
    const response = await handler(
      {
        requestId: "request-masterclass",
        type: "masterclass",
        delivery: { telegram: "sent" },
        outcome: "success",
      },
      { process },
    )(
      request({
        ...validBody,
        type: "masterclass",
        productSlugs: undefined,
        items: undefined,
        masterclassTopic: MASTERCLASS_TOPICS[1],
        eventDate: "2099-01-01",
        eventTime: "14:30",
      }),
    );

    expect(response.status).toBe(201);
    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "masterclass",
        masterclassTopic: MASTERCLASS_TOPICS[1],
        eventDate: "2099-01-01",
        eventTime: "14:30",
      }),
      expect.any(Object),
    );
  });

  test("returns 403 for an invalid Origin", async () => {
    const result = {
      requestId: "unused",
      type: "order" as const,
      delivery: { telegram: "sent" as const },
      outcome: "success" as const,
    };
    expect((await handler(result)(request(validBody, { headers: { Origin: "https://evil.test" } }))).status).toBe(403);
  });

  test("returns 405 with Allow header", async () => {
    const response = await handler({
      requestId: "unused",
      type: "order",
      delivery: { telegram: "sent" },
      outcome: "success",
    })(request(undefined, { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  test("returns 413 before parsing an oversized body", async () => {
    const response = await handler({
      requestId: "unused",
      type: "order",
      delivery: { telegram: "sent" },
      outcome: "success",
    })(
      request(validBody, {
        headers: { "Content-Length": String(20 * 1024) },
      }),
    );
    expect(response.status).toBe(413);
  });

  test("returns controlled 503 when configuration is missing", async () => {
    const response = await createApplicationsHandler({
      environment: () => ({
        success: false,
        missing: ["TELEGRAM_BOT_TOKEN"],
      }),
    })(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("TELEGRAM_BOT_TOKEN");
  });

  test("exposes 429 contract through an injected platform guard", async () => {
    const response = await handler(
      {
        requestId: "unused",
        type: "order",
        delivery: { telegram: "sent" },
        outcome: "success",
      },
      { rateLimitGuard: async () => false },
    )(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  test("limits one client to five application attempts per minute", async () => {
    let now = 1_000;
    const rateLimitGuard = createApplicationRateLimitGuard({
      now: () => now,
    });
    const process = vi.fn(async () => ({
      requestId: "request-limited",
      type: "order" as const,
      delivery: { telegram: "sent" as const },
      outcome: "success" as const,
    }));
    const limitedHandler = createApplicationsHandler({
      environment: () => ({ success: true, value: environment }),
      process,
      rateLimitGuard,
    });
    const clientRequest = () =>
      request(validBody, {
        headers: { "x-vercel-forwarded-for": "203.0.113.20" },
      });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await limitedHandler(clientRequest())).status).toBe(201);
    }
    const limited = await limitedHandler(clientRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(process).toHaveBeenCalledTimes(5);

    now += 60_000;
    expect((await limitedHandler(clientRequest())).status).toBe(201);
  });

  test("metadata-only logs never include PII", async () => {
    const logger = vi.fn();
    const response = await handler(
      {
        requestId: "request-safe",
        type: "order",
        delivery: { telegram: "sent" },
        outcome: "success",
      },
      { logger },
    )(request());
    expect(response.status).toBe(201);
    expect(JSON.stringify(logger.mock.calls)).not.toMatch(/Ana|Popescu|069|Кишинёв/u);
  });
});
