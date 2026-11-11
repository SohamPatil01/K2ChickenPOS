-- K2 Chicken customer mobile app extension (ADDITIVE ONLY).
-- * Adds one enum value (PreOrderSource.MOBILE_APP) and new tables.
-- * Does not alter, drop or rewrite any existing POS table or column.
-- * Idempotent: safe to re-run (IF NOT EXISTS / duplicate_object guards).
-- * NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block on PG < 12.
--   Railway/Postgres 14+ is fine.
-- Rollback: see ./down.sql (drops only the tables created here; the enum value
-- cannot be removed in Postgres without recreating the type — it is harmless if unused).

-- AlterEnum
ALTER TYPE "PreOrderSource" ADD VALUE IF NOT EXISTS 'MOBILE_APP';

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "primaryCustomerId" TEXT,
    "deletionRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerIdentityLink" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "linkedVia" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OtpChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerSession" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "platform" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushDevice" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "sessionId" TEXT,
    "token" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'EXPO',
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" TIMESTAMP(3),
    "invalidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "identityId" TEXT NOT NULL,
    "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "planReminders" BOOLEAN NOT NULL DEFAULT true,
    "rewardUpdates" BOOLEAN NOT NULL DEFAULT true,
    "reorderReminders" BOOLEAN NOT NULL DEFAULT true,
    "quietStartMinutes" INTEGER NOT NULL DEFAULT 1290,
    "quietEndMinutes" INTEGER NOT NULL DEFAULT 480,
    "maxMarketingPerWeek" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("identityId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommunicationConsent" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MobileOrder" (
    "id" TEXT NOT NULL,
    "preOrderId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "quoteJson" JSONB NOT NULL,
    "estimatedTotalPaise" INTEGER NOT NULL,
    "fulfillment" TEXT NOT NULL,
    "addressId" TEXT,
    "addressSnapshot" JSONB,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "slotEnd" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "loyaltyPointsHeld" INTEGER NOT NULL DEFAULT 0,
    "loyaltyHoldStatus" TEXT NOT NULL DEFAULT 'NONE',
    "source" TEXT NOT NULL DEFAULT 'CART',
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyPlan" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "reminderMinutes" INTEGER NOT NULL,
    "fulfillment" TEXT NOT NULL DEFAULT 'PICKUP',
    "addressId" TEXT,
    "slotPreference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "skipDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextReminderAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyPlanReminder" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "forDate" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPlanReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationLog" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "isMarketing" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "title" TEXT,
    "deepLink" TEXT,
    "providerRef" TEXT,
    "campaignKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntegrationCursor" (
    "name" TEXT NOT NULL,
    "cursorAt" TIMESTAMP(3) NOT NULL,
    "cursorId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCursor_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReorderPrediction" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "rationale" TEXT NOT NULL,
    "purchaseCount" INTEGER NOT NULL,
    "medianIntervalDays" DOUBLE PRECISION,
    "usualWeekday" INTEGER,
    "avgOrderGrams" INTEGER,
    "lastPurchaseAt" TIMESTAMP(3),
    "nextExpectedAt" TIMESTAMP(3),
    "preferredProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReorderPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExperimentAssignment" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identityId" TEXT,
    "anonymousId" TEXT NOT NULL,
    "properties" JSONB,
    "platform" TEXT,
    "appVersion" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DataRightsRequest" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataRightsRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MobileStoreConfig" (
    "storeId" TEXT NOT NULL,
    "appOrderingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serviceablePincodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliveryFeePaise" INTEGER NOT NULL DEFAULT 0,
    "freeDeliveryAbovePaise" INTEGER,
    "minOrderPaise" INTEGER NOT NULL DEFAULT 0,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "leadTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 3,
    "hoursJson" JSONB,
    "cutOptionsJson" JSONB,
    "customerCancelWindow" TEXT NOT NULL DEFAULT 'PENDING_ONLY',
    "supportPhone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileStoreConfig_pkey" PRIMARY KEY ("storeId")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerIdentity_phone_key" ON "CustomerIdentity"("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerIdentityLink_customerId_key" ON "CustomerIdentityLink"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerIdentityLink_identityId_idx" ON "CustomerIdentityLink"("identityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OtpChallenge_phone_createdAt_idx" ON "OtpChallenge"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSession_refreshTokenHash_key" ON "CustomerSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerSession_identityId_idx" ON "CustomerSession"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushDevice_identityId_idx" ON "PushDevice"("identityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunicationConsent_identityId_channel_purpose_createdAt_idx" ON "CommunicationConsent"("identityId", "channel", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MobileOrder_preOrderId_key" ON "MobileOrder"("preOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MobileOrder_identityId_createdAt_idx" ON "MobileOrder"("identityId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MobileOrder_customerId_idx" ON "MobileOrder"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MobileOrder_loyaltyHoldStatus_idx" ON "MobileOrder"("loyaltyHoldStatus");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MobileOrder_identityId_idempotencyKey_key" ON "MobileOrder"("identityId", "idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyPlan_identityId_idx" ON "WeeklyPlan"("identityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyPlan_status_nextReminderAt_idx" ON "WeeklyPlan"("status", "nextReminderAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyPlanReminder_planId_createdAt_idx" ON "WeeklyPlanReminder"("planId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyPlanReminder_planId_forDate_key" ON "WeeklyPlanReminder"("planId", "forDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationLog_identityId_createdAt_idx" ON "NotificationLog"("identityId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationLog_kind_createdAt_idx" ON "NotificationLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationLog_status_createdAt_idx" ON "NotificationLog"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OutboxEvent_dedupeKey_key" ON "OutboxEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OutboxEvent_type_createdAt_idx" ON "OutboxEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReorderPrediction_identityId_key" ON "ReorderPrediction"("identityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReorderPrediction_eligible_nextExpectedAt_idx" ON "ReorderPrediction"("eligible", "nextExpectedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExperimentAssignment_experimentKey_variant_idx" ON "ExperimentAssignment"("experimentKey", "variant");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExperimentAssignment_identityId_experimentKey_key" ON "ExperimentAssignment"("identityId", "experimentKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppAnalyticsEvent_name_occurredAt_idx" ON "AppAnalyticsEvent"("name", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppAnalyticsEvent_identityId_occurredAt_idx" ON "AppAnalyticsEvent"("identityId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DataRightsRequest_status_createdAt_idx" ON "DataRightsRequest"("status", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerIdentityLink" ADD CONSTRAINT "CustomerIdentityLink_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CustomerIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CustomerIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CustomerIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommunicationConsent" ADD CONSTRAINT "CommunicationConsent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CustomerIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MobileOrder" ADD CONSTRAINT "MobileOrder_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CustomerIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "CustomerIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WeeklyPlanReminder" ADD CONSTRAINT "WeeklyPlanReminder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- Match 20260526120000_enable_rls_public_tables: deny PostgREST anon access by default.
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'CustomerIdentity',
    'CustomerIdentityLink',
    'OtpChallenge',
    'CustomerSession',
    'PushDevice',
    'NotificationPreference',
    'CommunicationConsent',
    'MobileOrder',
    'WeeklyPlan',
    'WeeklyPlanReminder',
    'NotificationLog',
    'OutboxEvent',
    'IntegrationCursor',
    'ReorderPrediction',
    'ExperimentAssignment',
    'AppAnalyticsEvent',
    'DataRightsRequest',
    'MobileStoreConfig'
  ]) LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;
