-- Customer prepaid / surplus balance + full ledger
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "storeCredit" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "StoreCreditTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "StoreCreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StoreCreditTransaction_customerId_createdAt_idx" ON "StoreCreditTransaction"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "StoreCreditTransaction_storeId_idx" ON "StoreCreditTransaction"("storeId");
CREATE INDEX IF NOT EXISTS "StoreCreditTransaction_saleId_idx" ON "StoreCreditTransaction"("saleId");
CREATE INDEX IF NOT EXISTS "StoreCreditTransaction_type_idx" ON "StoreCreditTransaction"("type");

DO $$ BEGIN
  ALTER TABLE "StoreCreditTransaction" ADD CONSTRAINT "StoreCreditTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StoreCreditTransaction" ADD CONSTRAINT "StoreCreditTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StoreCreditTransaction" ADD CONSTRAINT "StoreCreditTransaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
