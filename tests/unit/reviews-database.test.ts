import { PrismaClient } from "@prisma/client";
import { afterAll, expect, test } from "vitest";

import { listPublicReviews, moderateReview, submitReview } from "../../server/reviews/review-service";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
const keys: string[] = [];
const input = {
  authorName: "AUTOMATED TEST ONLY",
  body: "Synthetic review for isolated database verification. Never publish as a customer review.",
  productSlug: null,
  locale: "ru" as const,
  consentAccepted: true as const,
  website: "",
};
const newKey = () => {
  const key = `test-review-${randomUUID()}`;
  keys.push(key);
  return key;
};

afterAll(async () => {
  const rows = await db.review.findMany({ where: { idempotencyKey: { in: keys } }, select: { id: true } });
  const ids = rows.map((row) => row.id);
  await db.$transaction([
    db.reviewModerationAudit.deleteMany({ where: { reviewId: { in: ids } } }),
    db.review.deleteMany({ where: { id: { in: ids } } }),
  ]);
  await db.$disconnect();
});

test("review persists pending, publishes only after approval, and survives rejection with audits", async () => {
  const key = newKey();
  await submitReview(db, input, key);
  const row = await db.review.findUniqueOrThrow({ where: { idempotencyKey: key } });
  expect(row.status).toBe("PENDING");
  expect((await listPublicReviews(db, 1)).reviews.some((item) => item.id === row.id)).toBe(false);
  expect(await moderateReview(db, { id: row.id, version: 0, status: "APPROVED" }, "test-admin")).toBe(true);
  const published = (await listPublicReviews(db, 1)).reviews.find((item) => item.id === row.id);
  expect(published?.body).toBe(input.body);
  expect(published).not.toHaveProperty("idempotencyKey");
  expect(await moderateReview(db, { id: row.id, version: 1, status: "REJECTED" }, "test-admin")).toBe(true);
  expect((await listPublicReviews(db, 1)).reviews.some((item) => item.id === row.id)).toBe(false);
  const rejected = await db.review.findUniqueOrThrow({ where: { id: row.id }, include: { moderationAudits: true } });
  expect(rejected.status).toBe("REJECTED");
  expect(rejected.moderationAudits).toHaveLength(2);
});

test("parallel retries create one review and concurrent moderation accepts only one decision", async () => {
  const key = newKey();
  expect(await Promise.all([submitReview(db, input, key), submitReview(db, input, key)])).toEqual([
    "accepted",
    "accepted",
  ]);
  expect(await db.review.count({ where: { idempotencyKey: key } })).toBe(1);
  expect(await submitReview(db, { ...input, body: "Changed payload must not reuse an accepted attempt" }, key)).toBe(
    "conflict",
  );
  const row = await db.review.findUniqueOrThrow({ where: { idempotencyKey: key } });
  const results = await Promise.all([
    moderateReview(db, { id: row.id, version: 0, status: "APPROVED" }, "test-admin-1"),
    moderateReview(db, { id: row.id, version: 0, status: "REJECTED" }, "test-admin-2"),
  ]);
  expect(results.sort()).toEqual([false, true]);
  expect(await db.reviewModerationAudit.count({ where: { reviewId: row.id } })).toBe(1);
});

test("public filter respects the selected product and hides unpublished product reviews", async () => {
  const first = newKey();
  const second = newKey();
  await submitReview(db, { ...input, productSlug: "lord-deodorant" }, first);
  await submitReview(db, { ...input, productSlug: "draft-test-product" }, second);
  for (const key of [first, second]) {
    const row = await db.review.findUniqueOrThrow({ where: { idempotencyKey: key } });
    await moderateReview(db, { id: row.id, version: 0, status: "APPROVED" }, "test-admin");
  }
  const rows = (await listPublicReviews(db, 1, "lord-deodorant")).reviews;
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.productSlug === "lord-deodorant")).toBe(true);
  expect((await listPublicReviews(db, 1)).reviews.some((row) => row.productSlug === "draft-test-product")).toBe(false);
});
