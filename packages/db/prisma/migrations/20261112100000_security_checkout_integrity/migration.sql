-- Staff refresh sessions
CREATE TABLE IF NOT EXISTS "StaffSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffSession_refreshTokenHash_key" ON "StaffSession"("refreshTokenHash");
CREATE INDEX IF NOT EXISTS "StaffSession_userId_idx" ON "StaffSession"("userId");
CREATE INDEX IF NOT EXISTS "StaffSession_previousTokenHash_idx" ON "StaffSession"("previousTokenHash");

DO $$ BEGIN
  ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Refund model
DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM ('COMPLETED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Refund" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "processedByUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Refund_storeId_idempotencyKey_key" ON "Refund"("storeId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "Refund_saleId_idx" ON "Refund"("saleId");
CREATE INDEX IF NOT EXISTS "Refund_storeId_createdAt_idx" ON "Refund"("storeId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Refund" ADD CONSTRAINT "Refund_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Refund" ADD CONSTRAINT "Refund_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Refund" ADD CONSTRAINT "Refund_processedByUserId_fkey"
    FOREIGN KEY ("processedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment idempotency: clear duplicate (saleId, txnRef) keeping oldest
DELETE FROM "Payment" a
  USING "Payment" b
  WHERE a."txnRef" IS NOT NULL
    AND a."saleId" = b."saleId"
    AND a."txnRef" = b."txnRef"
    AND a."createdAt" > b."createdAt";

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_saleId_txnRef_key" ON "Payment"("saleId", "txnRef");

-- Sync event idempotency + status
ALTER TABLE "SyncEvent" ADD COLUMN IF NOT EXISTS "clientEventId" TEXT;
ALTER TABLE "SyncEvent" ADD COLUMN IF NOT EXISTS "processingError" TEXT;
ALTER TABLE "SyncEvent" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "SyncEvent_storeId_deviceId_clientEventId_key"
  ON "SyncEvent"("storeId", "deviceId", "clientEventId");
CREATE INDEX IF NOT EXISTS "SyncEvent_status_idx" ON "SyncEvent"("status");
