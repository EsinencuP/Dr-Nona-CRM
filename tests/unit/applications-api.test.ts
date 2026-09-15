import { describe, expect, test, vi } from "vitest";

import { type ApplicationsHandlerDependencies, createApplicationsHandler } from "../../server/api/applications-handler";
import type { ApplicationServiceResult } from "../../server/applications/application-types";
import type { ContactEnvironment } from "../../server/config/contact-env";
import { createApplicationRateLimitGuard } from "../../server/http/application-rate-limit";
import { MASTERCLASS_TOPICS } from "../../shared/constants/masterclass-topics";

const validMasterclassDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Chisinau",
}).format(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

const environment: ContactEnvironment = {
  allowedOrigins: new Set(["https://example.test"]),
  telegramBotToken: "test-token",
  telegramChatId: "test-chat",
  proxySharedSecret: "test-shared-secret-at-least-32-bytes",
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
    verifyProxy: async () => ({ valid: true, clientKey: "a".repeat(43) }),
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
      expect(process).toHaveBeenCalledWith(expect.objectContaining({ locale }), expect.any(Object), {
        idempotencyKey: "attempt-1",
      });
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
        eventDate: validMasterclassDate,
        eventTime: "14:30",
      }),
    );

    expect(response.status).toBe(201);
    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "masterclass",
        masterclassTopic: MASTERCLASS_TOPICS[1],
        eventDate: validMasterclassDate,
        eventTime: "14:30",
      }),
      expect.any(Object),
      { idempotencyKey: "attempt-1" },
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

  test("returns 503 instead of a false quota response when the distributed store is unavailable", async () => {
    const response = await handler(
      {
        requestId: "unused",
        type: "order",
        delivery: { telegram: "sent" },
        outcome: "success",
      },
      { rateLimitGuard: async () => ({ allowed: false, retryAfterSeconds: 30, reason: "store_unavailable" }) },
    )(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  test("rejects an unauthenticated proxy request before rate or application processing", async () => {
    const process = vi.fn();
    const rateLimitGuard = vi.fn();
    const logger = vi.fn();
    const response = await handler(
      {
        requestId: "unused",
        type: "order",
        delivery: { telegram: "sent" },
        outcome: "success",
      },
      {
        process,
        rateLimitGuard,
        logger,
        verifyProxy: async () => ({ valid: false, reason: "signature" }),
      },
    )(request());

    expect(response.status).toBe(403);
    expect(process).not.toHaveBeenCalled();
    expect(rateLimitGuard).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith({ event: "application.proxy.rejected", reason: "signature" });
  });

  test("limits one client to five application attempts per minute", async () => {
    let now = 1_000;
    const attempts = new Map<string, number>();
    const rateLimitGuard = createApplicationRateLimitGuard({
      now: () => now,
      increment: async ({ id }) => {
        const next = (attempts.get(id) ?? 0) + 1;
        attempts.set(id, next);
        return next;
      },
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
      verifyProxy: async () => ({ valid: true, clientKey: "a".repeat(43) }),
    });
    const clientRequest = () =>
      request(validBody, {
        headers: { "x-dr-nona-client-key": "a".repeat(43) },
      });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await limitedHandler(clientRequest())).status).toBe(201);
    }
    const limited = await limitedHandler(clientRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("59");
    expect(process).toHaveBeenCalledTimes(5);

    now += 60_000;
    expect((await limitedHandler(clientRequest())).status).toBe(201);
  });

  test("shares one persistent counter across independent serverless guard instances", async () => {
    const attempts = new Map<string, number>();
    const increment = async ({ id }: { id: string }) => {
      const next = (attempts.get(id) ?? 0) + 1;
      attempts.set(id, next);
      return next;
    };
    const firstInstance = createApplicationRateLimitGuard({ limit: 2, now: () => 10_000, increment });
    const secondInstance = createApplicationRateLimitGuard({ limit: 2, now: () => 10_000, increment });
    const signedRequest = request(validBody, { headers: { "x-dr-nona-client-key": "b".repeat(43) } });

    await expect(firstInstance(signedRequest)).resolves.toMatchObject({ allowed: true });
    await expect(secondInstance(signedRequest)).resolves.toMatchObject({ allowed: true });
    await expect(firstInstance(signedRequest)).resolves.toMatchObject({ allowed: false, reason: "limit" });
  });

  test("fails closed when trusted identity or the persistent rate store is unavailable", async () => {
    const missingIdentity = createApplicationRateLimitGuard({ increment: async () => 1 });
    await expect(missingIdentity(request())).resolves.toMatchObject({
      allowed: false,
      reason: "identity_unavailable",
    });

    const unavailableStore = createApplicationRateLimitGuard({
      increment: async () => {
        throw new Error("store unavailable");
      },
    });
    await expect(
      unavailableStore(request(validBody, { headers: { "x-dr-nona-client-key": "c".repeat(43) } })),
    ).resolves.toMatchObject({ allowed: false, reason: "store_unavailable" });
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

  test.each([
    ["conflict", "IDEMPOTENCY_CONFLICT"],
    ["in_progress", "REQUEST_IN_PROGRESS"],
  ] as const)("returns a stable 409 for %s idempotency state", async (outcome, code) => {
    const response = await handler({
      requestId: "request-existing",
      type: "order",
      delivery: { telegram: "pending" },
      outcome,
    })(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, code });
    if (outcome === "in_progress") expect(response.headers.get("Retry-After")).toBe("30");
  });
});
