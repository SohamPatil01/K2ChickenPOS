#!/bin/bash

# Script to migrate all data from Supabase (virtual database) to local database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Data Migration: Supabase → Local Database ===${NC}\n"

# Remote database (Supabase) - NON-POOLING connection for data export
REMOTE_DB_URL="${REMOTE_DATABASE_URL:-postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require}"

# Local database
LOCAL_DB_NAME="azela_pos"
LOCAL_DB_URL="postgresql://postgres@localhost:5432/${LOCAL_DB_NAME}"

echo -e "${YELLOW}Step 1: Checking connections...${NC}"

# Check if local database exists
if ! psql -lqt | cut -d \| -f 1 | grep -qw "$LOCAL_DB_NAME"; then
    echo -e "${RED}Error: Local database '$LOCAL_DB_NAME' does not exist!${NC}"
    echo "Creating database..."
    createdb "$LOCAL_DB_NAME" || {
        echo -e "${RED}Failed to create database. Please create it manually.${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✓ Local database exists${NC}"

# Test remote connection
echo -e "${YELLOW}Testing remote database connection...${NC}"
if ! psql "$REMOTE_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to remote database!${NC}"
    echo "Please check your REMOTE_DATABASE_URL environment variable"
    echo "Or set it: export REMOTE_DATABASE_URL='your-connection-string'"
    exit 1
fi

echo -e "${GREEN}✓ Remote database connection successful${NC}\n"

# Create temp directory for dump file
TEMP_DIR=$(mktemp -d)
DUMP_FILE="$TEMP_DIR/dump.sql"

echo -e "${YELLOW}Step 2: Exporting data from remote database...${NC}"

# Export data only (no schema) from remote database
pg_dump "$REMOTE_DB_URL" \
    --data-only \
    --no-owner \
    --no-acl \
    --column-inserts \
    --file="$DUMP_FILE" \
    --verbose 2>&1 | grep -E "(dumping|ERROR)" || true

if [ ! -f "$DUMP_FILE" ] || [ ! -s "$DUMP_FILE" ]; then
    echo -e "${RED}Error: Failed to export data from remote database${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo -e "${GREEN}✓ Data exported successfully (Size: $DUMP_SIZE)${NC}\n"

echo -e "${YELLOW}Step 3: Clearing existing data from local database...${NC}"

# Get list of tables (excluding Prisma migration tables)
TABLES=$(psql "$LOCAL_DB_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%';")

# Disable foreign key checks temporarily and truncate tables
psql "$LOCAL_DB_URL" <<EOF
-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Truncate all tables (cascade to handle foreign keys)
DO \$\$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%') 
    LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
    END LOOP;
END \$\$;

-- Re-enable triggers
SET session_replication_role = 'origin';
EOF

echo -e "${GREEN}✓ Local database cleared${NC}\n"

echo -e "${YELLOW}Step 4: Importing data into local database...${NC}"

# Import the dump file
psql "$LOCAL_DB_URL" -f "$DUMP_FILE" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Data imported successfully${NC}\n"
else
    echo -e "${YELLOW}Warning: Some errors occurred during import (this may be normal)${NC}\n"
fi

# Clean up
rm -rf "$TEMP_DIR"

echo -e "${YELLOW}Step 5: Verifying data...${NC}"

# Count records in a few key tables
echo "Record counts:"
psql "$LOCAL_DB_URL" -c "
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
ORDER BY table_name;
"

echo -e "\n${GREEN}=== Migration Complete! ===${NC}"
echo -e "All data has been migrated from Supabase to your local database."
echo -e "Local database: ${LOCAL_DB_NAME}"

