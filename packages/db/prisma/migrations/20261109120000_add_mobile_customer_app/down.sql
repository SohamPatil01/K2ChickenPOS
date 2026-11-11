-- Rollback for 20261109120000_add_mobile_customer_app.
-- DESTRUCTIVE for app-only data (sessions, plans, consents audit, notification logs).
-- Take a backup first (scripts/backup-before-migration.sh). POS data is untouched.
-- Preserve CommunicationConsent rows if you have a legal retention obligation.
BEGIN;
DROP TABLE IF EXISTS "MobileStoreConfig" CASCADE;
DROP TABLE IF EXISTS "DataRightsRequest" CASCADE;
DROP TABLE IF EXISTS "AppAnalyticsEvent" CASCADE;
DROP TABLE IF EXISTS "ExperimentAssignment" CASCADE;
DROP TABLE IF EXISTS "ReorderPrediction" CASCADE;
DROP TABLE IF EXISTS "IntegrationCursor" CASCADE;
DROP TABLE IF EXISTS "OutboxEvent" CASCADE;
DROP TABLE IF EXISTS "NotificationLog" CASCADE;
DROP TABLE IF EXISTS "WeeklyPlanReminder" CASCADE;
DROP TABLE IF EXISTS "WeeklyPlan" CASCADE;
DROP TABLE IF EXISTS "MobileOrder" CASCADE;
DROP TABLE IF EXISTS "CommunicationConsent" CASCADE;
DROP TABLE IF EXISTS "NotificationPreference" CASCADE;
DROP TABLE IF EXISTS "PushDevice" CASCADE;
DROP TABLE IF EXISTS "CustomerSession" CASCADE;
DROP TABLE IF EXISTS "OtpChallenge" CASCADE;
DROP TABLE IF EXISTS "CustomerIdentityLink" CASCADE;
DROP TABLE IF EXISTS "CustomerIdentity" CASCADE;
COMMIT;
-- Then: DELETE FROM "_prisma_migrations" WHERE migration_name = '20261109120000_add_mobile_customer_app';
-- Enum value PreOrderSource.MOBILE_APP stays (Postgres cannot drop enum values). Existing
-- PreOrder rows with source = MOBILE_APP must be kept or updated to 'WEB_FORM' before any type rebuild.
