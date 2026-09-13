import { describe, expect, test } from "vitest";

import { createApplicationIdempotency, IDEMPOTENCY_TTL_MS } from "../../server/applications/application-idempotency";
import type { ApplicationInput } from "../../shared/applications/application-schema";

const input: ApplicationInput = {
  locale: "ru-MD",
  type: "order",
  firstName: "Ana",
  lastName: "Popescu",
  phone: "069123456",
  city: "Кишинёв",
  consentAccepted: true,
  productSlugs: ["lord-deodorant"],
};

describe("application idempotency fingerprint", () => {
  test("is stable across object key order and never contains raw input", () => {
    const now = new Date("2030-01-01T00:00:00.000Z");
    const left = createApplicationIdempotency(input, "private-key", now);
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as ApplicationInput;
    const right = createApplicationIdempotency(reordered, "private-key", now);

    expect(left.keyHash).toBe(right.keyHash);
    expect(left.payloadHash).toBe(right.payloadHash);
    expect(JSON.stringify(left)).not.toMatch(/private-key|Ana|069123456/u);
    expect(left.expiresAt.getTime() - now.getTime()).toBe(IDEMPOTENCY_TTL_MS);
  });

  test("changes when either key or validated payload changes", () => {
    const now = new Date("2030-01-01T00:00:00.000Z");
    const baseline = createApplicationIdempotency(input, "key-one", now);
    expect(createApplicationIdempotency(input, "key-two", now).keyHash).not.toBe(baseline.keyHash);
    expect(createApplicationIdempotency({ ...input, city: "Бельцы" }, "key-one", now).payloadHash).not.toBe(
      baseline.payloadHash,
    );
  });
});
