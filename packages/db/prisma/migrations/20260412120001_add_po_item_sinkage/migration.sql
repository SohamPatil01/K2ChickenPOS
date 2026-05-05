-- PurchaseOrderItem sinkage (see schema.prisma)
ALTER TABLE "PurchaseOrderItem"
ADD COLUMN IF NOT EXISTS "sinkageQtyKg" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sinkageQtyPcs" INTEGER;
