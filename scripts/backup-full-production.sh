#!/usr/bin/env bash
# Full migration backup: every Postgres app table (SELECT *) → Vercel Blob + local download.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="${API_URL:-https://k2-chicken-pos-api.vercel.app}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUPS_DIR="${BACKUPS_DIR:-$ROOT/backups}"
mkdir -p "$BACKUPS_DIR"

auth_args=(-H "Content-Type: application/json")
if [ -n "${BACKUP_SECRET:-}" ]; then
  auth_args+=(-H "X-Backup-Secret: $BACKUP_SECRET")
else
  auth_args+=(-H "x-vercel-cron: 1")
fi

echo -e "${GREEN}=== Full migration backup (all tables) ===${NC}\n"
echo -e "${BLUE}API:${NC} $API_URL"

echo -e "${YELLOW}Step 1: Creating full backup on production...${NC}"
CREATE_BODY=$(curl -s -X POST "${API_URL}/api/v1/backup/create-full" "${auth_args[@]}")

if ! echo "$CREATE_BODY" | grep -q '"success":true'; then
  echo -e "${RED}Full backup failed:${NC}"
  echo "$CREATE_BODY" | jq '.' 2>/dev/null || echo "$CREATE_BODY"
  echo ""
  echo -e "${YELLOW}If route not found, deploy latest API first, then re-run this script.${NC}"
  echo -e "${YELLOW}Or with DATABASE_URL set: pnpm exec tsx scripts/export-full-database.ts${NC}"
  exit 1
fi

TS=$(echo "$CREATE_BODY" | jq -r '.timestamp // empty')
SIZE=$(echo "$CREATE_BODY" | jq -r '.backupSize // empty')
echo -e "${GREEN}✓ Full backup created${NC} (${TS}, ${SIZE} bytes)"
echo "$CREATE_BODY" | jq -r '.tables // {} | to_entries[] | "  \(.key): \(.value)"'

echo -e "\n${YELLOW}Step 2: Resolving latest full-backup blob...${NC}"
LIST_BODY=$(curl -s "${API_URL}/api/v1/backup/list" "${auth_args[@]}")
LATEST_URL=$(echo "$LIST_BODY" | jq -r '[.backups[]? | select(.filename | startswith("full-backup-"))] | sort_by(.uploadedAt // .filename) | reverse | .[0].url // empty')
LATEST_NAME=$(echo "$LIST_BODY" | jq -r '[.backups[]? | select(.filename | startswith("full-backup-"))] | sort_by(.uploadedAt // .filename) | reverse | .[0].filename // empty')

if [ -z "$LATEST_URL" ]; then
  FALLBACK_NAME="full-backup-$(echo "$TS" | tr ':' '-').json"
  LATEST_URL="https://om69zl13qkyjuykz.public.blob.vercel-storage.com/${FALLBACK_NAME}"
  LATEST_NAME="$FALLBACK_NAME"
  echo -e "${YELLOW}List API missed full-backup; trying ${FALLBACK_NAME}${NC}"
fi

SAFE_TS=$(echo "$TS" | tr ':' '-' | tr 'T' '_')
LOCAL_FILE="${BACKUPS_DIR}/full_backup_${SAFE_TS}.json"
MANIFEST_FILE="${BACKUPS_DIR}/full_backup_${SAFE_TS}.manifest.json"

echo -e "${YELLOW}Step 3: Downloading ${LATEST_NAME}...${NC}"
curl -L --retry 3 --max-time 300 "$LATEST_URL" -o "$LOCAL_FILE"

if [ ! -s "$LOCAL_FILE" ]; then
  echo -e "${RED}Download failed${NC}"
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  jq '{
    filename: "'"$LATEST_NAME"'",
    kind: .metadata.kind,
    version: .metadata.version,
    downloadedAt: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    metadata: .metadata,
    tableCounts: (.data | to_entries | map({key: .key, count: (.value | length)}) | from_entries)
  }' "$LOCAL_FILE" > "$MANIFEST_FILE"
fi

echo -e "${GREEN}✓ Full migration backup saved locally:${NC}"
echo "  $LOCAL_FILE ($(du -h "$LOCAL_FILE" | cut -f1))"
[ -f "$MANIFEST_FILE" ] && echo "  $MANIFEST_FILE"
echo ""
echo -e "${BLUE}Restore to a new database:${NC}"
echo "  1. Create empty Postgres DB and set DATABASE_URL"
echo "  2. pnpm --filter @azela-pos/db exec prisma migrate deploy"
echo "  3. pnpm exec tsx scripts/restore-from-cloud-backup.ts \"$LOCAL_FILE\""
echo ""
echo -e "${BLUE}Native Postgres dump (if you have DATABASE_URL):${NC}"
echo "  ./scripts/pg-dump-production.sh"
