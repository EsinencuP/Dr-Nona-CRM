CREATE TABLE "ReportExportAudit" (
  "id" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "report" TEXT NOT NULL,
  "columns" JSONB NOT NULL,
  "fromDate" TIMESTAMP(3),
  "toDate" TIMESTAMP(3),
  "includeDemo" BOOLEAN NOT NULL DEFAULT false,
  "outcome" TEXT NOT NULL,
  "rowCount" INTEGER,
  "fileBytes" INTEGER,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportExportAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportExportAudit_actor_createdAt_idx" ON "ReportExportAudit"("actor", "createdAt");
CREATE INDEX "ReportExportAudit_createdAt_idx" ON "ReportExportAudit"("createdAt");
