-- Pre-orders: customer booking + staff phone bookings

DO $$ BEGIN
  CREATE TYPE "PreOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'READY', 'FULFILLED', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PreOrderSource" AS ENUM ('WEB_FORM', 'PHONE_CALL', 'WHATSAPP', 'WALK_IN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PreOrder" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "fulfillment" "DeliveryType" NOT NULL DEFAULT 'PICKUP',
  "readyAt" TIMESTAMP(3) NOT NULL,
  "status" "PreOrderStatus" NOT NULL DEFAULT 'PENDING',
  "source" "PreOrderSource" NOT NULL DEFAULT 'WEB_FORM',
  "notes" TEXT,
  "createdByUserId" TEXT,
  "saleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PreOrderItem" (
  "id" TEXT NOT NULL,
  "preOrderId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT NOT NULL,
  "unitType" "UnitType" NOT NULL DEFAULT 'KG',
  "qtyKg" DOUBLE PRECISION,
  "qtyPcs" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PreOrder_storeId_status_readyAt_idx" ON "PreOrder"("storeId", "status", "readyAt");
CREATE INDEX IF NOT EXISTS "PreOrder_storeId_readyAt_idx" ON "PreOrder"("storeId", "readyAt");
CREATE INDEX IF NOT EXISTS "PreOrder_customerPhone_idx" ON "PreOrder"("customerPhone");
CREATE INDEX IF NOT EXISTS "PreOrder_saleId_idx" ON "PreOrder"("saleId");
CREATE INDEX IF NOT EXISTS "PreOrderItem_preOrderId_idx" ON "PreOrderItem"("preOrderId");
CREATE INDEX IF NOT EXISTS "PreOrderItem_productId_idx" ON "PreOrderItem"("productId");

DO $$ BEGIN
  ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreOrderItem" ADD CONSTRAINT "PreOrderItem_preOrderId_fkey"
    FOREIGN KEY ("preOrderId") REFERENCES "PreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreOrderItem" ADD CONSTRAINT "PreOrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
