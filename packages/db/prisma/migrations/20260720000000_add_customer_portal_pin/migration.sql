-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalPinHash" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalRegisteredAt" TIMESTAMP(3);
