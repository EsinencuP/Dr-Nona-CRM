import { Prisma, type PrismaClient } from "@prisma/client";

import productRecords from "../../src/data/products.json";
import type { ReviewInput } from "./review-schema";

const publishedSlugs = productRecords
  .filter((product) => product.publicationStatus === "published" && product.editorialStatus === "ready")
  .map((product) => product.slug);

import { createHash } from "node:crypto";

export async function submitReview(db: PrismaClient, input: ReviewInput, idempotencyKey: string) {
  const payloadHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  try {
    await db.review.create({
      data: {
        authorName: input.authorName,
        body: input.body,
        productSlug: input.productSlug,
        locale: input.locale,
        consentAcceptedAt: new Date(),
        idempotencyKey,
        payloadHash,
      },
    });
    return "accepted" as const;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await db.review.findUnique({ where: { idempotencyKey }, select: { payloadHash: true } });
    return existing?.payloadHash === payloadHash ? ("accepted" as const) : ("conflict" as const);
  }
}

export async function listPublicReviews(db: PrismaClient, page: number, productSlug?: string) {
  const rows = await db.review.findMany({
    where: {
      status: "APPROVED",
      OR: [{ productSlug: null }, { productSlug: { in: publishedSlugs } }],
      ...(productSlug ? { productSlug } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 12,
    take: 13,
    select: { id: true, authorName: true, body: true, productSlug: true, locale: true, createdAt: true },
  });
  return { reviews: rows.slice(0, 12), hasMore: rows.length > 12 };
}

export async function moderateReview(
  db: PrismaClient,
  input: { id: string; version: number; status: "APPROVED" | "REJECTED" },
  actor: string,
) {
  return db.$transaction(async (tx) => {
    const current = await tx.review.findUnique({ where: { id: input.id }, select: { status: true, version: true } });
    if (!current || current.version !== input.version) return false;
    const updated = await tx.review.updateMany({
      where: { id: input.id, version: input.version },
      data: { status: input.status, version: { increment: 1 }, moderatedAt: new Date(), moderatedBy: actor },
    });
    if (updated.count !== 1) return false;
    await tx.reviewModerationAudit.create({
      data: { reviewId: input.id, fromStatus: current.status, toStatus: input.status, actor },
    });
    return true;
  });
}
