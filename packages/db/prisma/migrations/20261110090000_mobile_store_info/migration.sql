-- Store address and map link for the customer app's store info screen (additive, nullable).
ALTER TABLE "MobileStoreConfig" ADD COLUMN IF NOT EXISTS "addressText" TEXT;
ALTER TABLE "MobileStoreConfig" ADD COLUMN IF NOT EXISTS "mapsUrl" TEXT;
