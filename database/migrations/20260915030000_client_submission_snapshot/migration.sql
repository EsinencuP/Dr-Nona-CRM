ALTER TABLE "Order"
  ADD COLUMN "submittedFirstName" TEXT,
  ADD COLUMN "submittedLastName" TEXT,
  ADD COLUMN "submittedPhone" TEXT,
  ADD COLUMN "submittedEmail" TEXT,
  ADD COLUMN "submittedRegion" TEXT;

UPDATE "Order" AS orders
SET
  "submittedFirstName" = clients."firstName",
  "submittedLastName" = clients."lastName",
  "submittedPhone" = clients."phone",
  "submittedEmail" = clients."email",
  "submittedRegion" = clients."region"
FROM "Client" AS clients
WHERE clients."id" = orders."clientId";

ALTER TABLE "Order"
  ALTER COLUMN "submittedFirstName" SET NOT NULL,
  ALTER COLUMN "submittedLastName" SET NOT NULL,
  ALTER COLUMN "submittedPhone" SET NOT NULL,
  ALTER COLUMN "submittedRegion" SET NOT NULL;

CREATE TABLE "ClientProfileAudit" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientProfileAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientProfileAudit_clientId_createdAt_idx"
  ON "ClientProfileAudit"("clientId", "createdAt");

ALTER TABLE "ClientProfileAudit"
  ADD CONSTRAINT "ClientProfileAudit_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
