-- Additive only: the legacy internal price cannot establish both approved prices.
-- Zero is an unavailable-price sentinel, not evidence of a free product.
ALTER TABLE "ProductCatalog"
  ADD COLUMN "retailPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "distributorPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem"
  ADD COLUMN "retailPriceAtPurchase" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "distributorPriceAtPurchase" DOUBLE PRECISION NOT NULL DEFAULT 0;
