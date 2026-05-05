-- Run ONCE against your PRODUCTION Postgres (same DB as Vercel DATABASE_URL).
-- Fixes: "The column Sale.offlineIdempotencyKey does not exist in the current database"
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "offlineIdempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Sale_storeId_offlineIdempotencyKey_key"
  ON "Sale"("storeId", "offlineIdempotencyKey");
