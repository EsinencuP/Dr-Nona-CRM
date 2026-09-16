-- Block 3: durable Telegram delivery, status audit, attribution and SLA timestamp.
CREATE TYPE "TelegramOutboxState" AS ENUM ('PENDING', 'SENDING', 'DELIVERED', 'NEEDS_REVIEW', 'TERMINAL', 'CANCELLED');

ALTER TABLE "Order"
  ADD COLUMN "attribution" JSONB,
  ADD COLUMN "firstActionAt" TIMESTAMP(3);

CREATE TABLE "OrderStatusAudit" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "fromStatus" "OrderStatus" NOT NULL,
  "toStatus" "OrderStatus" NOT NULL,
  "source" TEXT NOT NULL,
  "actorKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStatusAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramOutbox" (
  "orderId" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "state" "TelegramOutboxState" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "providerMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramOutbox_pkey" PRIMARY KEY ("orderId")
);

CREATE TABLE "TelegramCommandAudit" (
  "id" TEXT NOT NULL,
  "updateId" TEXT NOT NULL,
  "actorKey" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramCommandAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderStatusAudit_orderId_createdAt_idx" ON "OrderStatusAudit"("orderId", "createdAt");
CREATE INDEX "OrderStatusAudit_createdAt_idx" ON "OrderStatusAudit"("createdAt");
CREATE UNIQUE INDEX "TelegramOutbox_providerMessageId_key" ON "TelegramOutbox"("providerMessageId");
CREATE INDEX "TelegramOutbox_state_nextAttemptAt_idx" ON "TelegramOutbox"("state", "nextAttemptAt");
CREATE INDEX "TelegramOutbox_updatedAt_idx" ON "TelegramOutbox"("updatedAt");
CREATE UNIQUE INDEX "TelegramCommandAudit_updateId_key" ON "TelegramCommandAudit"("updateId");
CREATE INDEX "TelegramCommandAudit_actorKey_createdAt_idx" ON "TelegramCommandAudit"("actorKey", "createdAt");
CREATE INDEX "TelegramCommandAudit_orderId_createdAt_idx" ON "TelegramCommandAudit"("orderId", "createdAt");

ALTER TABLE "OrderStatusAudit" ADD CONSTRAINT "OrderStatusAudit_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramOutbox" ADD CONSTRAINT "TelegramOutbox_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramCommandAudit" ADD CONSTRAINT "TelegramCommandAudit_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
