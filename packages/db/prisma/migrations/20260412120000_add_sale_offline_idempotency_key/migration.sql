-- Align DB with schema: offline sale replay / idempotency (see Sale.offlineIdempotencyKey in schema.prisma)
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "offlineIdempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Sale_storeId_offlineIdempotencyKey_key" ON "Sale"("storeId", "offlineIdempotencyKey");
