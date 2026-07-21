#!/usr/bin/env bash
# Restore July 15 (or any) pg_dump into a NEW Neon project.
#
# 1) Create a new project at https://console.neon.tech (free tier is fine)
# 2) Copy BOTH connection strings from Neon → Connection details:
#      - Pooled  → DATABASE_URL  (has "-pooler" in host)
#      - Direct  → DIRECT_DATABASE_URL (no pooler, port 5432)
# 3) Run:
#      export NEW_DATABASE_URL='postgres://...@ep-XXXX...neon.tech/neondb?sslmode=require'
#      ./scripts/restore-to-new-neon.sh
#
# Optional:
#      DUMP=backups/pg_dump_2026-07-15T16-15-17Z.dump ./scripts/restore-to-new-neon.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:${PATH:-}"

DUMP="${DUMP:-$ROOT/backups/pg_dump_2026-07-15T16-15-17Z.dump}"
NEW_URL="${NEW_DATABASE_URL:-${DIRECT_DATABASE_URL_NEW:-}}"

if [ -z "$NEW_URL" ]; then
  echo -e "${RED}Set NEW_DATABASE_URL to the NEW Neon DIRECT (non-pooler) connection string.${NC}"
  echo "  export NEW_DATABASE_URL='postgres://...@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require'"
  exit 1
fi

# Prefer direct / non-pooler for restore
if echo "$NEW_URL" | grep -q 'pooler'; then
  echo -e "${YELLOW}Warning: URL looks pooled. Prefer the Direct connection for restore.${NC}"
fi

if [ ! -f "$DUMP" ]; then
  echo -e "${RED}Dump not found: $DUMP${NC}"
  exit 1
fi

echo -e "${GREEN}=== Restore dump → new Neon ===${NC}"
echo -e "${BLUE}Dump:${NC} $DUMP ($(du -h "$DUMP" | cut -f1))"
echo -e "${BLUE}Target host:${NC} $(echo "$NEW_URL" | sed -E 's|.*@([^/]+)/.*|\1|')"
echo ""

echo -e "${YELLOW}1) Testing connection...${NC}"
if ! psql "$NEW_URL" -c "SELECT current_database() AS db, now() AS t;" >/dev/null; then
  echo -e "${RED}Cannot connect. Check NEW_DATABASE_URL / SSL / project is awake.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Connected${NC}"

echo -e "${YELLOW}2) Restoring (this may take a few minutes)...${NC}"
pg_restore \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -d "$NEW_URL" \
  "$DUMP" || true
# pg_restore returns non-zero on some benign notices; verify counts below.

echo -e "${YELLOW}3) Verifying row counts...${NC}"
psql "$NEW_URL" -c "
SELECT 'Sale' AS t, COUNT(*)::int AS n FROM \"Sale\"
UNION ALL SELECT 'SaleItem', COUNT(*)::int FROM \"SaleItem\"
UNION ALL SELECT 'Payment', COUNT(*)::int FROM \"Payment\"
UNION ALL SELECT 'Customer', COUNT(*)::int FROM \"Customer\"
UNION ALL SELECT 'Product', COUNT(*)::int FROM \"Product\"
UNION ALL SELECT 'InventoryLedger', COUNT(*)::int FROM \"InventoryLedger\"
ORDER BY 1;
"

echo ""
echo -e "${GREEN}✓ Restore finished${NC}"
echo ""
echo "Next — update env (local .env + Vercel projects: api, web, loyalty-web):"
echo "  DATABASE_URL        = Neon POOLED connection string"
echo "  DIRECT_DATABASE_URL = Neon DIRECT connection string (same as NEW_DATABASE_URL)"
echo ""
echo "Then redeploy / restart API and test login + sales."
echo ""
echo -e "${YELLOW}Note:${NC} This dump is from 2026-07-15. Sales after that date are not included"
echo "until the old Neon project unlocks or Neon support recovers a later snapshot."
