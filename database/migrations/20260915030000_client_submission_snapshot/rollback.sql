DROP TABLE "ClientProfileAudit";

ALTER TABLE "Order"
  DROP COLUMN "submittedFirstName",
  DROP COLUMN "submittedLastName",
  DROP COLUMN "submittedPhone",
  DROP COLUMN "submittedEmail",
  DROP COLUMN "submittedRegion";
