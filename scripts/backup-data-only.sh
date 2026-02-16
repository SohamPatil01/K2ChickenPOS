#!/bin/bash

# Backup only DATA (no schema). Read-only: does not alter the database.
# Use this when you only need to preserve table contents for restore/migration.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== Data-only backup (read-only; does not alter database) ===${NC}\n"

# Use same logic as backup-localhost.sh for connection
LOCAL_DB_NAME="${LOCAL_DB_NAME:-azela_pos}"
LOCAL_DB_USER="${LOCAL_DB_USER:-postgres}"
if [ -n "$DATABASE_URL" ] && ([[ "$DATABASE_URL" == *"localhost"* ]] || [[ "$DATABASE_URL" == *"127.0.0.1"* ]]); then
    LOCAL_DB_URL="$DATABASE_URL"
else
    LOCAL_DB_URL=""
fi

BACKUPS_DIR="backups"
mkdir -p "$BACKUPS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUPS_DIR}/backup_localhost_dataonly_${TIMESTAMP}.sql"

if [ -n "$LOCAL_DB_URL" ]; then
    psql "$LOCAL_DB_URL" -c "SELECT 1;" > /dev/null 2>&1 || { echo -e "${RED}Error: Cannot connect to database. Check DATABASE_URL and that PostgreSQL is running.${NC}"; exit 1; }
    pg_dump "$LOCAL_DB_URL" --data-only --no-owner --no-acl -f "$BACKUP_FILE"
else
    psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "SELECT 1;" > /dev/null 2>&1 || { echo -e "${RED}Error: Cannot connect to database.${NC}"; exit 1; }
    pg_dump -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" --data-only --no-owner --no-acl -f "$BACKUP_FILE"
fi

[ -s "$BACKUP_FILE" ] || { echo -e "${RED}Error: Backup file empty.${NC}"; exit 1; }
echo -e "${GREEN}✓ Data-only backup saved: $BACKUP_FILE${NC} ($(du -h "$BACKUP_FILE" | cut -f1))"
