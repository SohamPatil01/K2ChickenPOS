-- Additive only: nullable columns + unique index. No drops or data deletes.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referredByCustomerId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referralBonusAwardedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_referralCode_key" ON "Customer"("referralCode");
