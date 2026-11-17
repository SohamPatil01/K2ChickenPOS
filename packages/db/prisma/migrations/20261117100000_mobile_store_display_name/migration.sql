-- Customer-app-only store name (additive, nullable). The POS keeps Store.name.
ALTER TABLE "MobileStoreConfig" ADD COLUMN IF NOT EXISTS "appDisplayName" TEXT;
