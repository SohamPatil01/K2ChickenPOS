-- OPTIONAL: App no longer requires this column (offline idempotency uses AuditLog).
-- Safe to run if you already planned to add it; uses IF NOT EXISTS.

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "offlineIdempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Sale_storeId_offlineIdempotencyKey_key"
  ON "Sale"("storeId", "offlineIdempotencyKey");
