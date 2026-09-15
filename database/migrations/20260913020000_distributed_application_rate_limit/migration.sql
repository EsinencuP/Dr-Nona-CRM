-- Fixed-window rate-limit counters shared across all CRM serverless instances.
-- clientKey is an HMAC-anonymized value produced by the authenticated catalogue proxy.
CREATE TABLE "ApplicationRateLimitBucket" (
    "id" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApplicationRateLimitBucket_expiresAt_idx" ON "ApplicationRateLimitBucket"("expiresAt");
