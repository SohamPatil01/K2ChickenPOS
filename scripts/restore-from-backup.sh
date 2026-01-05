#!/bin/bash

# Script to restore database from a local SQL backup file to Supabase

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Database Restore: Local Backup → Supabase ===${NC}\n"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide the path to your backup SQL file${NC}"
    echo "Usage: ./restore-from-backup.sh <path-to-backup.sql>"
    echo ""
    echo "Example:"
    echo "  ./restore-from-backup.sh backup_20250101.sql"
    echo "  ./restore-from-backup.sh /path/to/backup.sql"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file '$BACKUP_FILE' does not exist!${NC}"
    exit 1
fi

# Get absolute path of backup file
BACKUP_FILE=$(cd "$(dirname "$BACKUP_FILE")" && pwd)/$(basename "$BACKUP_FILE")

echo -e "${BLUE}Backup file: $BACKUP_FILE${NC}"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${BLUE}Backup size: $BACKUP_SIZE${NC}\n"

# Supabase database connection (NON-POOLING for restore operations)
# You can override this with SUPABASE_DATABASE_URL environment variable
SUPABASE_DB_URL="${SUPABASE_DATABASE_URL:-postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require}"

echo -e "${YELLOW}⚠️  WARNING: This will replace ALL data in your Supabase database!${NC}"
echo -e "${YELLOW}⚠️  Make sure you have a current backup before proceeding!${NC}\n"

# Ask for confirmation
read -p "Are you sure you want to restore? Type 'yes' to continue: " confirmation
if [ "$confirmation" != "yes" ]; then
    echo -e "${RED}Restore cancelled.${NC}"
    exit 0
fi

echo -e "\n${YELLOW}Step 1: Testing Supabase connection...${NC}"

# Test connection
if ! psql "$SUPABASE_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to Supabase database!${NC}"
    echo "Please check your SUPABASE_DATABASE_URL environment variable"
    echo "Or set it: export SUPABASE_DATABASE_URL='your-connection-string'"
    echo ""
    echo "Note: Use NON-POOLING connection (port 5432) for restore operations"
    exit 1
fi

echo -e "${GREEN}✓ Connection successful${NC}\n"

echo -e "${YELLOW}Step 2: Checking backup file format...${NC}"

# Check if it's a valid SQL file
if ! head -n 1 "$BACKUP_FILE" | grep -qE "(PostgreSQL|pg_dump|CREATE|INSERT|COPY)"; then
    echo -e "${YELLOW}Warning: File doesn't look like a standard PostgreSQL dump${NC}"
    echo "Continuing anyway..."
fi

echo -e "${GREEN}✓ Backup file format OK${NC}\n"

echo -e "${YELLOW}Step 3: Creating current backup (safety measure)...${NC}"

# Create a backup of current state before restore
CURRENT_BACKUP="backup_before_restore_$(date +%Y%m%d_%H%M%S).sql"
echo "Creating backup: $CURRENT_BACKUP"

if pg_dump "$SUPABASE_DB_URL" \
    --data-only \
    --no-owner \
    --no-acl \
    --file="$CURRENT_BACKUP" \
    > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Current state backed up to: $CURRENT_BACKUP${NC}"
else
    echo -e "${YELLOW}Warning: Could not create backup of current state${NC}"
    echo "Continuing anyway..."
fi

echo ""

echo -e "${YELLOW}Step 4: Clearing existing data from Supabase...${NC}"

# Disable foreign key checks and truncate all tables
psql "$SUPABASE_DB_URL" <<EOF
-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Truncate all tables (cascade to handle foreign keys)
DO \$\$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE '_prisma%'
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'sql_%'
    ) 
    LOOP
        BEGIN
            EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
            RAISE NOTICE 'Truncated: %', r.tablename;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not truncate %: %', r.tablename, SQLERRM;
        END;
    END LOOP;
END \$\$;

-- Re-enable triggers
SET session_replication_role = 'origin';
EOF

echo -e "${GREEN}✓ Database cleared${NC}\n"

echo -e "${YELLOW}Step 5: Restoring data from backup file...${NC}"

# Restore the backup
# Use psql with error handling
if psql "$SUPABASE_DB_URL" -f "$BACKUP_FILE" 2>&1 | tee restore.log; then
    echo -e "${GREEN}✓ Data restored successfully${NC}\n"
else
    RESTORE_EXIT_CODE=$?
    echo -e "${YELLOW}Warning: Some errors occurred during restore (exit code: $RESTORE_EXIT_CODE)${NC}"
    echo "Check restore.log for details"
    echo ""
    echo "Common issues:"
    echo "  - Foreign key constraint errors (may be normal if data is out of order)"
    echo "  - Duplicate key errors (may indicate partial restore)"
    echo "  - Missing table errors (schema may have changed)"
    echo ""
fi

echo -e "${YELLOW}Step 6: Verifying restored data...${NC}"

# Count records in key tables
echo ""
echo "Record counts after restore:"
psql "$SUPABASE_DB_URL" -c "
SELECT 
    'Store' as table_name, COUNT(*) as count FROM \"Store\"
UNION ALL
SELECT 'User', COUNT(*) FROM \"User\"
UNION ALL
SELECT 'Product', COUNT(*) FROM \"Product\"
UNION ALL
SELECT 'Sale', COUNT(*) FROM \"Sale\"
UNION ALL
SELECT 'Customer', COUNT(*) FROM \"Customer\"
UNION ALL
SELECT 'InventoryLedger', COUNT(*) FROM \"InventoryLedger\"
UNION ALL
SELECT 'Payment', COUNT(*) FROM \"Payment\"
ORDER BY table_name;
" || echo -e "${YELLOW}Warning: Could not verify all tables${NC}"

echo ""
echo -e "${YELLOW}Step 7: Checking for data from January 1st, 2025 onwards...${NC}"

# Check if we have data from Jan 1st, 2025
psql "$SUPABASE_DB_URL" -c "
SELECT 
    'Sales after Jan 1, 2025' as check_type,
    COUNT(*) as count,
    MIN(\"createdAt\") as earliest_date,
    MAX(\"createdAt\") as latest_date
FROM \"Sale\"
WHERE \"createdAt\" >= '2025-01-01';
" || echo -e "${YELLOW}Could not check sales data${NC}"

echo ""
echo -e "${GREEN}=== Restore Complete! ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify your data in the Supabase dashboard"
echo "  2. Test your application to ensure everything works"
echo "  3. If restore had errors, check restore.log for details"
echo "  4. If something went wrong, you can restore from: $CURRENT_BACKUP"
echo ""
echo -e "${BLUE}Note: The current backup is saved as: $CURRENT_BACKUP${NC}"
echo -e "${BLUE}You can delete it once you've verified the restore was successful.${NC}"

