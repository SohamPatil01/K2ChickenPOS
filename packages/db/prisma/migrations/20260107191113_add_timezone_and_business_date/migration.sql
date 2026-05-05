-- Add timezone column to Store table (safe: additive only)
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- Add businessDate column to Sale table (safe: nullable, no data loss)
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "businessDate" TIMESTAMP(3);

-- Add businessDate column to Shift table (safe: nullable, no data loss)
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "businessDate" TIMESTAMP(3);

-- Add index for performance: (storeId, businessDate) on Sale
CREATE INDEX IF NOT EXISTS "Sale_storeId_businessDate_idx" ON "Sale"("storeId", "businessDate");

-- Note: Existing data will have NULL businessDate initially
-- Run backfill script to populate businessDate for existing records

