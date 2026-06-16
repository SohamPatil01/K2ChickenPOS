#!/usr/bin/env bash
# Migrate K2ChickenPOS from Supabase → Neon (schema + all data).
#
# Prerequisites:
#   - Neon project created at https://neon.tech (copy connection strings)
#   - psql / pg_dump installed
#   - pnpm install at repo root
#
# Usage:
#   export SUPABASE_DATABASE_URL='postgres://...@...supabase.com:5432/postgres?sslmode=require'
#   export NEON_DATABASE_URL='postgres://...@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require'
#   # optional — pooled URL for Vercel after cutover:
#   export NEON_POOLED_DATABASE_URL='postgres://...@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
#   ./scripts/migrate-to-neon.sh
#
# Do NOT commit database URLs or passwords.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUPS_DIR="${BACKUPS_DIR:-$ROOT/backups}"
mkdir -p "$BACKUPS_DIR"
TS="$(date -u +"%Y%m%d_%H%M%S")"
DATA_SQL="${BACKUPS_DIR}/supabase_data_only_${TS}.sql"

if [ -f "${ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

# Resolve Neon / Supabase URLs from common .env names (last non-empty wins).
resolve_neon_direct() {
  for v in NEON_DATABASE_URL DIRECT_DATABASE_URL DATABASE_URL_UNPOOLED POSTGRES_URL_NON_POOLING; do
    if [ -n "${!v:-}" ]; then
      echo "${!v}"
      return
    fi
  done
}

resolve_neon_pooled() {
  for v in NEON_POOLED_DATABASE_URL DATABASE_URL POSTGRES_URL POSTGRES_PRISMA_URL; do
    if [ -n "${!v:-}" ]; then
      echo "${!v}"
      return
    fi
  done
}

SUPABASE_URL="${SUPABASE_DATABASE_URL:-${SOURCE_DATABASE_URL:-}}"
NEON_URL="$(resolve_neon_direct)"
NEON_POOLED="$(resolve_neon_pooled)"

if [ -z "$NEON_URL" ]; then
  echo -e "${RED}Error: set Neon direct URL (DIRECT_DATABASE_URL or DATABASE_URL_UNPOOLED)${NC}"
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo -e "${YELLOW}SUPABASE_DATABASE_URL not set — will use JSON full backup for data import${NC}"
  USE_JSON_BACKUP=1
else
  USE_JSON_BACKUP=0
fi

# Force session/direct ports for admin tools
normalize_direct_url() {
  local url="$1"
  echo "$url" | sed -E 's/:6543\//:5432\//' | sed 's/[?&]pgbouncer=true//g' | sed 's/?&/?/' | sed 's/\?$//'
}

SUPABASE_URL="$(normalize_direct_url "$SUPABASE_URL")"
NEON_URL="$(normalize_direct_url "$NEON_URL")"

echo -e "${GREEN}=== Safe Supabase → Neon migration (production stays on Supabase until Vercel cutover) ===${NC}\n"

echo -e "${YELLOW}Step 1: Test connections${NC}"
if [ -n "$SUPABASE_URL" ]; then
  psql "$SUPABASE_URL" -c "SELECT 'supabase' AS src, pg_size_pretty(pg_database_size(current_database())) AS size;"
else
  echo "  (skip Supabase — using local full backup)"
fi
psql "$NEON_URL" -c "SELECT 'neon' AS dst, version();"

echo -e "\n${YELLOW}Step 2: Apply full schema on Neon (empty target — Supabase untouched)${NC}"
export DATABASE_URL="$NEON_URL"
export DIRECT_DATABASE_URL="$NEON_URL"
cd "$ROOT"

echo -e "${YELLOW}  Resetting Neon public schema${NC}"
psql "$NEON_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;"

echo -e "${YELLOW}  prisma db push (full schema from schema.prisma)${NC}"
pnpm --filter @azela-pos/db exec prisma db push --accept-data-loss --skip-generate

echo -e "${YELLOW}  Recording migration history${NC}"
pnpm --filter @azela-pos/db exec prisma migrate deploy 2>/dev/null || true
for dir in packages/db/prisma/migrations/*/; do
  name="$(basename "$dir")"
  pnpm --filter @azela-pos/db exec prisma migrate resolve --applied "$name" 2>/dev/null || true
done

if [ "$USE_JSON_BACKUP" = "1" ]; then
  BACKUP_JSON="${FULL_BACKUP_JSON:-}"
  if [ -z "$BACKUP_JSON" ]; then
    BACKUP_JSON="$(ls -t "$BACKUPS_DIR"/full_backup_*.json 2>/dev/null | head -1)"
  fi
  if [ -z "$BACKUP_JSON" ] || [ ! -f "$BACKUP_JSON" ]; then
    echo -e "${RED}No full_backup_*.json found. Run: ./scripts/backup-full-production.sh${NC}"
    exit 1
  fi
  echo -e "\n${YELLOW}Step 3–4: Import from JSON backup (read-only source)${NC}"
  echo "  $BACKUP_JSON"
  pnpm --filter @azela-pos/db exec tsx ../../scripts/restore-from-cloud-backup.ts "$BACKUP_JSON"
else
  echo -e "\n${YELLOW}Step 3: Export data from Supabase (data-only, read-only)${NC}"
  pg_dump "$SUPABASE_URL" \
    --data-only \
    --no-owner \
    --no-acl \
    --exclude-table-data='_prisma_migrations' \
    --disable-triggers \
    --file="$DATA_SQL"
  echo -e "${GREEN}✓ Wrote ${DATA_SQL} ($(du -h "$DATA_SQL" | cut -f1))${NC}"

  echo -e "\n${YELLOW}Step 4: Import data into Neon${NC}"
  psql "$NEON_URL" -v ON_ERROR_STOP=1 <<EOF
SET session_replication_role = replica;
\\i ${DATA_SQL}
SET session_replication_role = DEFAULT;
EOF
fi

echo -e "\n${YELLOW}Step 5: Verify row counts${NC}"
pnpm --filter @azela-pos/db exec tsx ../../scripts/verify-neon-migration.ts "$NEON_URL" ${SUPABASE_URL:+"$SUPABASE_URL"}

echo -e "\n${GREEN}=== Migration complete ===${NC}"
echo -e "${BLUE}Next steps (required for production):${NC}"
echo "  1. Vercel → k2-chicken-pos-api → Settings → Environment Variables"
if [ -n "${NEON_POOLED_DATABASE_URL:-}" ]; then
  echo "     DATABASE_URL = $NEON_POOLED_DATABASE_URL"
  echo "     DIRECT_DATABASE_URL = $NEON_URL"
else
  echo "     DATABASE_URL = <Neon pooled connection string from dashboard>"
  echo "     DIRECT_DATABASE_URL = $NEON_URL"
fi
echo "  2. Redeploy API: git push or Vercel → Deployments → Redeploy"
echo "  3. Smoke test: login, sales list, create test sale, dashboard totals"
echo "  4. After 24–48h stable: pause or delete Supabase project"
echo ""
echo -e "${YELLOW}Fallback if pg_dump import failed:${NC}"
echo "  DATABASE_URL=\"$NEON_URL\" pnpm exec tsx scripts/restore-from-cloud-backup.ts backups/full_backup_2026-06-16_02-45-19.927Z.json"
