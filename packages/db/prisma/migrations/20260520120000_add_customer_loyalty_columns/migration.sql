-- Customer loyalty fields (schema had these; production may have been created before they existed)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "loyaltyPoints" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "loyaltyTier" TEXT NOT NULL DEFAULT 'BRONZE';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0;
