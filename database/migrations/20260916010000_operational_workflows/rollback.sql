DROP TABLE IF EXISTS "TelegramCommandAudit";
DROP TABLE IF EXISTS "TelegramOutbox";
DROP TABLE IF EXISTS "OrderStatusAudit";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "attribution", DROP COLUMN IF EXISTS "firstActionAt";
DROP TYPE IF EXISTS "TelegramOutboxState";
