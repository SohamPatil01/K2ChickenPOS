-- Pre-order tracking code, cancel reason, and event timeline

ALTER TABLE "PreOrder" ADD COLUMN IF NOT EXISTS "trackingCode" TEXT;
ALTER TABLE "PreOrder" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

-- Backfill tracking codes for any existing rows
UPDATE "PreOrder"
SET "trackingCode" = upper(substr(md5(random()::text || id), 1, 6))
WHERE "trackingCode" IS NULL OR "trackingCode" = '';

DO $$ BEGIN
  ALTER TABLE "PreOrder" ALTER COLUMN "trackingCode" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PreOrder_storeId_trackingCode_key" ON "PreOrder"("storeId", "trackingCode");
CREATE INDEX IF NOT EXISTS "PreOrder_trackingCode_idx" ON "PreOrder"("trackingCode");

DO $$ BEGIN
  CREATE TYPE "PreOrderEventKind" AS ENUM ('STATUS', 'MESSAGE', 'NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PreOrderEvent" (
  "id" TEXT NOT NULL,
  "preOrderId" TEXT NOT NULL,
  "kind" "PreOrderEventKind" NOT NULL DEFAULT 'MESSAGE',
  "message" TEXT NOT NULL,
  "status" "PreOrderStatus",
  "visibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PreOrderEvent_preOrderId_createdAt_idx" ON "PreOrderEvent"("preOrderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PreOrderEvent" ADD CONSTRAINT "PreOrderEvent_preOrderId_fkey"
    FOREIGN KEY ("preOrderId") REFERENCES "PreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PreOrderEvent" ADD CONSTRAINT "PreOrderEvent_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
