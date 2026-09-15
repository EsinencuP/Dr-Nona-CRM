CREATE TYPE "OrderType" AS ENUM ('order', 'consultation', 'masterclass');
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PROCESSING', 'DELIVERY', 'DONE', 'CANCELLED');

ALTER TABLE "Order"
  ALTER COLUMN "type" TYPE "OrderType" USING ("type"::"OrderType"),
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::"OrderStatus"),
  ALTER COLUMN "status" SET DEFAULT 'NEW';
