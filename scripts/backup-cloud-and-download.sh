#!/usr/bin/env bash
# Trigger a full cloud DB backup (JSON → Vercel Blob) and download the latest copy locally.
# READ-ONLY on the database — no deletes or overwrites.
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

auth_header() {
  if [ -n "${BACKUP_SECRET:-}" ]; then
    echo "X-Backup-Secret: $BACKUP_SECRET"
  else
    echo "x-vercel-cron: 1"
  fi
}

echo -e "${GREEN}=== Cloud backup + local download ===${NC}\n"
echo -e "${BLUE}API:${NC} $API_URL"

echo -e "${YELLOW}Step 1: Triggering cloud backup...${NC}"
CREATE_BODY=$(curl -s -X POST "${API_URL}/api/v1/backup/create" \
  -H "Content-Type: application/json" \
  -H "$(auth_header)")

if ! echo "$CREATE_BODY" | grep -q '"success":true'; then
  echo -e "${RED}Backup create failed:${NC}"
  echo "$CREATE_BODY" | jq '.' 2>/dev/null || echo "$CREATE_BODY"
  exit 1
fi

TS=$(echo "$CREATE_BODY" | jq -r '.timestamp // empty')
SIZE=$(echo "$CREATE_BODY" | jq -r '.backupSize // empty')
echo -e "${GREEN}✓ Cloud backup created${NC} (${TS}, ${SIZE} bytes)"
if command -v jq >/dev/null 2>&1; then
  echo "$CREATE_BODY" | jq -r '.tables // {} | to_entries[] | "  \(.key): \(.value)"'
fi

echo -e "\n${YELLOW}Step 2: Listing backups...${NC}"
LIST_BODY=$(curl -s "${API_URL}/api/v1/backup/list" -H "$(auth_header)")
LATEST_URL=$(echo "$LIST_BODY" | jq -r '[.backups[]?] | sort_by(.uploadedAt // .filename) | reverse | .[0].url // empty')
LATEST_NAME=$(echo "$LIST_BODY" | jq -r '[.backups[]?] | sort_by(.uploadedAt // .filename) | reverse | .[0].filename // empty')

if [ -z "$LATEST_URL" ]; then
  echo -e "${RED}Could not resolve latest backup URL${NC}"
  echo "$LIST_BODY" | jq '.' 2>/dev/null || echo "$LIST_BODY"
  exit 1
fi

SAFE_TS=$(echo "$TS" | tr ':' '-' | tr 'T' '_')
LOCAL_FILE="${BACKUPS_DIR}/cloud_backup_${SAFE_TS}.json"
MANIFEST_FILE="${BACKUPS_DIR}/cloud_backup_${SAFE_TS}.manifest.json"

echo -e "${YELLOW}Step 3: Downloading ${LATEST_NAME}...${NC}"
curl -sL "$LATEST_URL" -o "$LOCAL_FILE"

if [ ! -s "$LOCAL_FILE" ]; then
  echo -e "${RED}Download failed or file is empty${NC}"
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  jq '{
    filename: "'"$LATEST_NAME"'",
    downloadedAt: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    metadata: .metadata,
    tableCounts: (.data | to_entries | map({key: .key, count: (.value | length)}) | from_entries)
  }' "$LOCAL_FILE" > "$MANIFEST_FILE"
fi

echo -e "${GREEN}✓ Saved locally:${NC}"
echo "  $LOCAL_FILE ($(du -h "$LOCAL_FILE" | cut -f1))"
[ -f "$MANIFEST_FILE" ] && echo "  $MANIFEST_FILE"
echo ""
echo -e "${BLUE}Restore when needed:${NC}"
echo "  cd \"$ROOT\" && pnpm exec tsx scripts/restore-from-cloud-backup.ts \"$LOCAL_FILE\""
