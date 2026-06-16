-- Supabase storage fix for K2ChickenPOS
-- Run in Supabase Dashboard → SQL Editor

-- ========== 1) DIAGNOSTICS ==========
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- WAL size (large WAL = disk bloat even when tables are small)
SELECT pg_size_pretty(COALESCE((SELECT SUM(size) FROM pg_ls_waldir()), 0)::bigint) AS wal_size;

-- Stuck replication slots retain WAL and can balloon disk
SELECT slot_name, active,
  pg_size_pretty(COALESCE(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn), 0)::bigint) AS retained_wal
FROM pg_replication_slots;

-- Largest tables
SELECT
  c.relname AS table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  s.n_live_tup AS live_rows,
  s.n_dead_tup AS dead_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 15;

-- Base64 images in Product (should be 0 after cleanup)
SELECT COUNT(*) AS products_with_data_url
FROM "Product"
WHERE "imageUrl" LIKE 'data:%';

-- ========== 2) CLEANUP (safe for production) ==========
-- Prune old acked offline sync events (7+ days)
DELETE FROM "SyncEvent"
WHERE "ackedAt" IS NOT NULL
  AND "serverReceivedAt" < NOW() - INTERVAL '7 days';

-- Prune audit logs older than 90 days (POS audit trail; adjust if you need longer)
DELETE FROM "AuditLog"
WHERE "createdAt" < NOW() - INTERVAL '90 days';

-- Strip any remaining base64 product images
UPDATE "Product"
SET "imageUrl" = NULL, "updatedAt" = NOW()
WHERE "imageUrl" LIKE 'data:%';

-- ========== 3) RECLAIM SPACE ==========
-- Must run outside a transaction (SQL editor is fine)
VACUUM (VERBOSE, ANALYZE);

-- ========== 4) IF DISK STILL HIGH ON SUPABASE DASHBOARD ==========
-- Your Postgres DATA is likely ~30 MB. Supabase "usage" may be:
--   • Egress (data out to Vercel API) — reduce daily backups / heavy polling
--   • Provisioned disk (auto-scaled, does not shrink until Postgres upgrade)
-- Check: Organization → Usage → see which line item is over 5 GB
-- To right-size provisioned disk: Settings → Infrastructure → Upgrade Postgres version
-- (Supabase docs: disk rightsizes to ~1.2× database size after upgrade)
