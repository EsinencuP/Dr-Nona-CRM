CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE "Review" (
  "id" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "productSlug" TEXT,
  "locale" TEXT NOT NULL,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 0,
  "consentAcceptedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "moderatedAt" TIMESTAMP(3),
  "moderatedBy" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Review_idempotencyKey_key" ON "Review"("idempotencyKey");
CREATE INDEX "Review_status_createdAt_id_idx" ON "Review"("status", "createdAt", "id");
CREATE INDEX "Review_productSlug_status_createdAt_id_idx" ON "Review"("productSlug", "status", "createdAt", "id");
CREATE TABLE "ReviewModerationAudit" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "fromStatus" "ReviewStatus" NOT NULL,
  "toStatus" "ReviewStatus" NOT NULL,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewModerationAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewModerationAudit_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReviewModerationAudit_reviewId_createdAt_idx" ON "ReviewModerationAudit"("reviewId", "createdAt");
