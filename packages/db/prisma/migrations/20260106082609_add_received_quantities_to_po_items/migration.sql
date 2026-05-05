-- AlterTable: Add receivedQtyKg, receivedQtyPcs, and updatedAt columns to PurchaseOrderItem
-- These columns are nullable to preserve existing data

-- Add receivedQtyKg column (nullable Float)
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "receivedQtyKg" DOUBLE PRECISION;

-- Add receivedQtyPcs column (nullable Int)
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "receivedQtyPcs" INTEGER;

-- Add updatedAt column (nullable DateTime, will be set to createdAt for existing rows)
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Set updatedAt to createdAt for existing rows (if updatedAt is null)
UPDATE "PurchaseOrderItem" 
SET "updatedAt" = "createdAt" 
WHERE "updatedAt" IS NULL;

-- Make updatedAt NOT NULL and add default (after setting values for existing rows)
ALTER TABLE "PurchaseOrderItem" 
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
