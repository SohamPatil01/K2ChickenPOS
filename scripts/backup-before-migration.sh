#!/bin/bash

# Script to create a backup before running database migrations.
# READ-ONLY: pg_dump only reads from the database; it never modifies or deletes any data.
# Includes full database (schema + data). Backup is written only to a file in backups/.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Pre-Migration Backup Script ===${NC}\n"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set!${NC}"
    echo "Please set it: export DATABASE_URL='your-database-url'"
    exit 1
fi

# Create backups directory if it doesn't exist
BACKUPS_DIR="backups"
mkdir -p "$BACKUPS_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUPS_DIR/backup_pre_migration_${TIMESTAMP}.sql"

echo -e "${YELLOW}Step 1: Testing database connection...${NC}"

# Test connection
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to database!${NC}"
    echo "Please check your DATABASE_URL"
    exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}\n"

echo -e "${YELLOW}Step 2: Creating backup...${NC}"

# Create backup (schema + data). READ-ONLY: pg_dump does not modify the database.
# --clean --if-exists only affect the dump file (for restore); they are not run on the live DB.
pg_dump "$DATABASE_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --file="$BACKUP_FILE" \
    --verbose 2>&1 | grep -E "(dumping|ERROR)" || true

if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup failed!${NC}"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${GREEN}✓ Backup created successfully${NC}"
echo -e "  File: $BACKUP_FILE"
echo -e "  Size: $BACKUP_SIZE\n"

echo -e "${YELLOW}Step 3: Verifying backup...${NC}"

# Check if backup contains data
if grep -q "INSERT INTO" "$BACKUP_FILE"; then
    ROW_COUNT=$(grep -c "INSERT INTO" "$BACKUP_FILE" || echo "0")
    echo -e "${GREEN}✓ Backup contains data (${ROW_COUNT} INSERT statements)${NC}\n"
else
    echo -e "${YELLOW}⚠ Warning: Backup may not contain data${NC}\n"
fi

# Get table counts from database
echo -e "${YELLOW}Step 4: Recording current database state...${NC}"

STATE_FILE="$BACKUPS_DIR/backup_state_${TIMESTAMP}.txt"
psql "$DATABASE_URL" -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = schemaname AND table_name = tablename) as exists
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
" > "$STATE_FILE" 2>&1 || true

echo -e "${GREEN}✓ Database state recorded${NC}\n"

echo -e "${BLUE}=== Backup Complete ===${NC}"
echo -e "Backup file: ${GREEN}$BACKUP_FILE${NC}"
echo -e "State file: ${GREEN}$STATE_FILE${NC}"
echo -e "\n${YELLOW}You can now safely run migrations.${NC}"
echo -e "If something goes wrong, restore with:"
echo -e "${BLUE}./scripts/restore-from-backup.sh $BACKUP_FILE${NC}\n"

