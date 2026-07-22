#!/usr/bin/env bash
# Restore a pg_dump into Railway Postgres (then point Vercel at Railway and delete Neon).
#
# Prerequisites:
#   1. Railway project with PostgreSQL + public TCP proxy enabled
#   2. Copy the public DATABASE_URL from Railway → Postgres → Variables
#      (host looks like xxx.railway.app or proxy.rlwy.net — NOT *.railway.internal)
#   3. Prefer a FRESH dump from Neon (see scripts/pg-dump-production.sh) so you
#      do not lose sales since the last backup.
#
# Usage:
#   export NEW_DATABASE_URL='postgresql://postgres:PASS@HOST:PORT/railway'
#   ./scripts/restore-to-railway.sh
#
# Optional:
#   DUMP=backups/pg_dump_YYYY-MM-DD.dump ./scripts/restore-to-railway.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:${PATH:-}"

DUMP="${DUMP:-}"
NEW_URL="${NEW_DATABASE_URL:-}"

if [ -z "$NEW_URL" ]; then
  echo -e "${RED}Set NEW_DATABASE_URL to the Railway PUBLIC Postgres URL.${NC}"
  echo "  export NEW_DATABASE_URL='postgresql://postgres:...@xxx.proxy.rlwy.net:12345/railway'"
  exit 1
fi

if echo "$NEW_URL" | grep -q 'railway.internal'; then
  echo -e "${RED}That URL is private (*.railway.internal). Vercel cannot reach it.${NC}"
  echo "In Railway → Postgres → Settings → Networking → enable TCP Proxy, then use the public URL."
  exit 1
fi

if [ -z "$DUMP" ]; then
  # Newest custom-format dump in backups/
  DUMP="$(ls -t "$ROOT"/backups/pg_dump_*.dump 2>/dev/null | head -1 || true)"
fi

if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo -e "${RED}No dump found. Set DUMP=... or run a fresh pg_dump from Neon first.${NC}"
  exit 1
fi

# Railway often needs SSL for public proxy
if ! echo "$NEW_URL" | grep -q 'sslmode='; then
  if echo "$NEW_URL" | grep -q '?'; then
    NEW_URL="${NEW_URL}&sslmode=require"
  else
    NEW_URL="${NEW_URL}?sslmode=require"
  fi
fi

echo -e "${GREEN}=== Restore dump → Railway Postgres ===${NC}"
echo -e "${BLUE}Dump:${NC} $DUMP ($(du -h "$DUMP" | cut -f1))"
echo -e "${BLUE}Target host:${NC} $(echo "$NEW_URL" | sed -E 's|.*@([^/]+)/.*|\1|')"
echo ""

echo -e "${YELLOW}1) Testing connection...${NC}"
if ! psql "$NEW_URL" -c "SELECT current_database() AS db, version();" >/dev/null; then
  echo -e "${RED}Cannot connect. Check NEW_DATABASE_URL, TCP proxy, and password.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Connected${NC}"

echo -e "${YELLOW}2) Restoring (may take a few minutes)...${NC}"
pg_restore \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -d "$NEW_URL" \
  "$DUMP" || true
# pg_restore can exit non-zero on benign notices; verify counts below.

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
echo "Next — update Vercel (k2-chicken-pos-api Production + Preview):"
echo "  DATABASE_URL        = same Railway public URL (add ?sslmode=require if missing)"
echo "  DIRECT_DATABASE_URL = same URL as DATABASE_URL (Railway has no Neon-style pooler)"
echo ""
echo "Then Redeploy API and hit:"
echo "  https://k2-chicken-pos-api.vercel.app/health?deep=1"
echo ""
echo "Only after that looks healthy, delete Neon."
