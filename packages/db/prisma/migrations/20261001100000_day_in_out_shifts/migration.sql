-- Day In / Day Out: staff day PIN, shift cash fields, cash movements, sale.shiftId

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dayPinHash" TEXT;

ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "cashTakenHome" DOUBLE PRECISION;
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "pettyCashCarryForward" DOUBLE PRECISION;
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "overrideReason" TEXT;

CREATE INDEX IF NOT EXISTS "Shift_storeId_businessDate_idx" ON "Shift"("storeId", "businessDate");

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;
CREATE INDEX IF NOT EXISTS "Sale_shiftId_idx" ON "Sale"("shiftId");

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CashMovement" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "type" "CashMovementType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CashMovement_shiftId_idx" ON "CashMovement"("shiftId");
CREATE INDEX IF NOT EXISTS "CashMovement_storeId_createdAt_idx" ON "CashMovement"("storeId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "DailyClosing" ADD COLUMN IF NOT EXISTS "cashTakenHome" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DailyClosing" ADD COLUMN IF NOT EXISTS "pettyCashCarryForward" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DailyClosing" ADD COLUMN IF NOT EXISTS "cashInTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DailyClosing" ADD COLUMN IF NOT EXISTS "cashOutTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
