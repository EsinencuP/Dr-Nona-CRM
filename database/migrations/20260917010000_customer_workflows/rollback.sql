DROP TABLE IF EXISTS "CustomerNotification";
DROP TABLE IF EXISTS "ConsultationSlotAudit";
DROP TABLE IF EXISTS "ConsultationSlot";
DROP TABLE IF EXISTS "ClientNote";
DROP TYPE IF EXISTS "ConsultationSlotState";
DROP TYPE IF EXISTS "CustomerNotificationState";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "locale";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "customerNotificationsOptOutAt";
