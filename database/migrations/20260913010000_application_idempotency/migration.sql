-- Persistent, privacy-bounded application idempotency.
-- Raw keys and payloads are not stored; requestId is the existing Order identifier.
CREATE TYPE "ApplicationSubmissionState" AS ENUM ('DELIVERY_STARTED', 'DELIVERED', 'DELIVERY_FAILED');

CREATE TABLE "ApplicationSubmission" (
    "keyHash" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "state" "ApplicationSubmissionState" NOT NULL DEFAULT 'DELIVERY_STARTED',
    "providerMessageId" TEXT,
    "lastErrorCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSubmission_pkey" PRIMARY KEY ("keyHash")
);

CREATE UNIQUE INDEX "ApplicationSubmission_requestId_key" ON "ApplicationSubmission"("requestId");
CREATE INDEX "ApplicationSubmission_state_updatedAt_idx" ON "ApplicationSubmission"("state", "updatedAt");
CREATE INDEX "ApplicationSubmission_expiresAt_idx" ON "ApplicationSubmission"("expiresAt");

ALTER TABLE "ApplicationSubmission"
  ADD CONSTRAINT "ApplicationSubmission_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
