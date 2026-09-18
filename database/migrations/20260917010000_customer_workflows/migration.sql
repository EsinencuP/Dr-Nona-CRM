-- Block 5: consultation slots and auditable manager notes.
CREATE TYPE "ConsultationSlotState" AS ENUM ('OPEN', 'RESERVED', 'CLOSED', 'CANCELLED');
CREATE TYPE "CustomerNotificationState" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED', 'FAILED', 'NEEDS_REVIEW');

ALTER TABLE "Order" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru-MD';
ALTER TABLE "Client" ADD COLUMN "customerNotificationsOptOutAt" TIMESTAMP(3);

CREATE TABLE "ClientNote" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsultationSlot" (
  "id" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "mode" TEXT NOT NULL,
  "state" "ConsultationSlotState" NOT NULL DEFAULT 'OPEN',
  "reservedOrderId" TEXT,
  "reservedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsultationSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsultationSlotAudit" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "fromState" "ConsultationSlotState",
  "toState" "ConsultationSlotState" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsultationSlotAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerNotification" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "locale" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "state" "CustomerNotificationState" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "cost" DOUBLE PRECISION,
  "currency" TEXT,
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientNote_clientId_createdAt_idx" ON "ClientNote"("clientId", "createdAt");
CREATE UNIQUE INDEX "ConsultationSlot_startsAt_key" ON "ConsultationSlot"("startsAt");
CREATE UNIQUE INDEX "ConsultationSlot_reservedOrderId_key" ON "ConsultationSlot"("reservedOrderId");
CREATE INDEX "ConsultationSlot_state_startsAt_idx" ON "ConsultationSlot"("state", "startsAt");
ALTER TABLE "ConsultationSlot" ADD CONSTRAINT "ConsultationSlot_positive_duration" CHECK ("endsAt" > "startsAt");
ALTER TABLE "ConsultationSlot" ADD CONSTRAINT "ConsultationSlot_valid_mode" CHECK ("mode" IN ('online', 'offline'));
ALTER TABLE "ConsultationSlot" ADD CONSTRAINT "ConsultationSlot_no_overlap" EXCLUDE USING gist
  (tsrange("startsAt", "endsAt", '[)') WITH &&) WHERE ("state" <> 'CANCELLED');
CREATE INDEX "ConsultationSlotAudit_slotId_createdAt_idx" ON "ConsultationSlotAudit"("slotId", "createdAt");
CREATE UNIQUE INDEX "CustomerNotification_providerMessageId_key" ON "CustomerNotification"("providerMessageId");
CREATE UNIQUE INDEX "CustomerNotification_orderId_status_key" ON "CustomerNotification"("orderId", "status");
CREATE INDEX "CustomerNotification_state_createdAt_idx" ON "CustomerNotification"("state", "createdAt");

ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationSlot" ADD CONSTRAINT "ConsultationSlot_reservedOrderId_fkey"
  FOREIGN KEY ("reservedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsultationSlotAudit" ADD CONSTRAINT "ConsultationSlotAudit_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "ConsultationSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerNotification" ADD CONSTRAINT "CustomerNotification_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
