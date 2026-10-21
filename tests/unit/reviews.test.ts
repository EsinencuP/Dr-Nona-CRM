import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";

import { createReviewsHandler } from "../../server/api/reviews-handler";
import { reviewInputSchema } from "../../server/reviews/review-schema";
import { listPublicReviews, moderateReview, submitReview } from "../../server/reviews/review-service";

const input = {
  authorName: "Test Author",
  body: "A review used only in automated tests.",
  productSlug: null,
  locale: "ru" as const,
  consentAccepted: true as const,
  website: "",
};
const environment = {
  secret: () => "test",
  allowedOrigins: () => ["https://catalog.example"],
  verifyProxy: vi.fn().mockResolvedValue({ valid: true, clientKey: "test" }),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
};
const request = (body: unknown = input) =>
  new Request("https://crm.example/api/reviews", {
    method: "POST",
    headers: {
      origin: "https://catalog.example",
      "content-type": "application/json",
      "idempotency-key": "review-test-unique-key",
    },
    body: JSON.stringify(body),
  });

describe("review API boundaries", () => {
  test("requires exact allowed origin and signed proxy", async () => {
    const list = vi.fn();
    const handler = createReviewsHandler({ ...environment, list });
    expect((await handler(new Request("https://crm.example/api/reviews"))).status).toBe(403);
    const unsigned = createReviewsHandler({
      ...environment,
      verifyProxy: vi.fn().mockResolvedValue({ valid: false, reason: "missing" }),
      list,
    });
    expect((await unsigned(request())).status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
  test("accepts general and known SKU reviews only into moderation", async () => {
    const submit = vi.fn().mockResolvedValue("accepted");
    const handler = createReviewsHandler({ ...environment, submit });
    expect(await (await handler(request())).json()).toEqual({ ok: true, status: "PENDING" });
    expect((await handler(request({ ...input, productSlug: "lord-deodorant" }))).status).toBe(202);
    expect((await handler(request({ ...input, productSlug: "unpublished-sku" }))).status).toBe(400);
    expect(submit).toHaveBeenCalledTimes(2);
  });
  test("rejects missing consent, bot fields, oversized input, and client status injection", () => {
    for (const body of [
      { ...input, consentAccepted: false },
      { ...input, website: "bot" },
      { ...input, body: "x".repeat(3001) },
      { ...input, status: "APPROVED" },
    ])
      expect(reviewInputSchema.safeParse(body).success).toBe(false);
  });
  test("returns rate guard and persistence failures without fake success", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("DB unavailable"));
    const handler = createReviewsHandler({ ...environment, submit });
    expect((await handler(request())).status).toBe(503);
    expect(
      (
        await createReviewsHandler({
          ...environment,
          rateLimit: vi.fn().mockResolvedValue({ allowed: false, reason: "limit", retryAfterSeconds: 15 }),
        })(request())
      ).status,
    ).toBe(429);
    expect(
      (await createReviewsHandler({ ...environment, submit: vi.fn().mockResolvedValue("conflict") })(request())).status,
    ).toBe(409);
  });
});

describe("review persistence and publication", () => {
  test("public query selects approved reviews and excludes private moderation data", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listPublicReviews({ review: { findMany } } as unknown as PrismaClient, 2, "lord-deodorant");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "APPROVED", productSlug: "lord-deodorant" }),
        skip: 12,
        take: 13,
      }),
    );
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty("idempotencyKey");
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty("moderatedBy");
  });
  test("new reviews never set approval and repeated keys require identical payloads", async () => {
    const create = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn();
    const db = { review: { create, findUnique } } as unknown as PrismaClient;
    expect(await submitReview(db, input, "key")).toBe("accepted");
    expect(create.mock.calls[0][0].data).not.toHaveProperty("status");
    const hash = create.mock.calls[0][0].data.payloadHash;
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }),
    );
    findUnique.mockResolvedValue({ payloadHash: hash });
    expect(await submitReview(db, input, "key")).toBe("accepted");
    expect(await submitReview(db, { ...input, body: "A different review with same key" }, "key")).toBe("conflict");
  });
  test("moderation writes audit atomically and refuses stale administrator decisions", async () => {
    const tx = {
      review: {
        findUnique: vi.fn().mockResolvedValue({ status: "PENDING", version: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reviewModerationAudit: { create: vi.fn() },
    };
    const db = { $transaction: (run: (value: typeof tx) => Promise<boolean>) => run(tx) } as unknown as PrismaClient;
    expect(await moderateReview(db, { id: "test", version: 0, status: "APPROVED" }, "admin")).toBe(true);
    expect(tx.reviewModerationAudit.create).toHaveBeenCalledWith({
      data: { reviewId: "test", fromStatus: "PENDING", toStatus: "APPROVED", actor: "admin" },
    });
    tx.reviewModerationAudit.create.mockClear();
    expect(await moderateReview(db, { id: "test", version: 1, status: "REJECTED" }, "admin")).toBe(false);
    expect(tx.reviewModerationAudit.create).not.toHaveBeenCalled();
  });
});
