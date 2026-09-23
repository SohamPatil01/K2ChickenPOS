-- Staff-only notes on customer profile (cashier 360 view).
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "staffNotes" TEXT;
