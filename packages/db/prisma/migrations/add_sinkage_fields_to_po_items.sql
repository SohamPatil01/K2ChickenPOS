-- Migration: Add sinkage fields to PurchaseOrderItem
-- NOTE: Review this SQL before applying to production database

-- Add sinkage fields to PurchaseOrderItem table
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "sinkageQtyKg" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sinkageQtyPcs" INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN "PurchaseOrderItem"."sinkageQtyKg" IS 'Sinkage/wastage during receiving (in KG)';
COMMENT ON COLUMN "PurchaseOrderItem"."sinkageQtyPcs" IS 'Sinkage/wastage during receiving (in pieces)';

