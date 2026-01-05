#!/bin/bash

# Script to create a local backup of the localhost PostgreSQL database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Local Database Backup: localhost → Local File ===${NC}\n"

# Local database configuration
LOCAL_DB_NAME="${LOCAL_DB_NAME:-azela_pos}"
# Default connection - will use psql defaults if not specified
# Can be overridden with DATABASE_URL or LOCAL_DB_URL environment variables
LOCAL_DB_URL="${LOCAL_DB_URL:-}"
LOCAL_DB_USER="${LOCAL_DB_USER:-postgres}"

# Allow override via environment variable
if [ -n "$DATABASE_URL" ] && ([[ "$DATABASE_URL" == *"localhost"* ]] || [[ "$DATABASE_URL" == *"127.0.0.1"* ]]); then
    LOCAL_DB_URL="$DATABASE_URL"
    echo -e "${BLUE}Using DATABASE_URL from environment${NC}\n"
elif [ -z "$LOCAL_DB_URL" ]; then
    # Use psql connection parameters instead of connection string
    LOCAL_DB_URL=""  # Empty means use psql defaults with -U and -d flags
    echo -e "${BLUE}Using default local connection (postgres@localhost:5432/${LOCAL_DB_NAME})${NC}\n"
fi

# Create backups directory if it doesn't exist
BACKUPS_DIR="backups"
mkdir -p "$BACKUPS_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUPS_DIR}/backup_localhost_${TIMESTAMP}.sql"

echo -e "${YELLOW}Step 1: Testing local database connection...${NC}"

# Test connection
if [ -n "$LOCAL_DB_URL" ]; then
    # Use connection string
    if ! psql "$LOCAL_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        CONNECTION_FAILED=1
    fi
else
    # Use psql parameters
    if ! psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        CONNECTION_FAILED=1
    fi
fi

if [ -n "$CONNECTION_FAILED" ]; then
    echo -e "${RED}Error: Cannot connect to local database!${NC}"
    echo ""
    echo "Please check:"
    echo "  1. PostgreSQL is running: brew services start postgresql (macOS) or sudo systemctl start postgresql (Linux)"
    echo "  2. Database '$LOCAL_DB_NAME' exists"
    echo "  3. You have permission to access the database"
    echo ""
    echo "You can override the connection string:"
    echo "  export LOCAL_DB_URL='postgresql://user:password@localhost:5432/dbname'"
    echo "  export DATABASE_URL='postgresql://user:password@localhost:5432/dbname'"
    exit 1
fi

echo -e "${GREEN}✓ Connection successful${NC}\n"

echo -e "${YELLOW}Step 2: Getting database information...${NC}"

# Get database size and table counts
if [ -n "$LOCAL_DB_URL" ]; then
    DB_SIZE=$(psql "$LOCAL_DB_URL" -t -c "SELECT pg_size_pretty(pg_database_size('$LOCAL_DB_NAME'));" | xargs)
    TABLE_COUNT=$(psql "$LOCAL_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | xargs)
    PSQL_CMD="psql \"$LOCAL_DB_URL\""
else
    DB_SIZE=$(psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$LOCAL_DB_NAME'));" | xargs)
    TABLE_COUNT=$(psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | xargs)
    PSQL_CMD="psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME"
fi
echo -e "${BLUE}Database size: $DB_SIZE${NC}"
echo -e "${BLUE}Number of tables: $TABLE_COUNT${NC}"

# Get record counts for key tables
echo ""
echo "Record counts:"
if [ -n "$LOCAL_DB_URL" ]; then
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
UNION ALL
SELECT 'InventoryLedger', COUNT(*) FROM \"InventoryLedger\"
UNION ALL
SELECT 'Payment', COUNT(*) FROM \"Payment\"
ORDER BY table_name;
" 2>/dev/null || echo -e "${YELLOW}Warning: Could not get all table counts${NC}"
else
    psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "
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
" 2>/dev/null || echo -e "${YELLOW}Warning: Could not get all table counts${NC}"
fi

echo ""

echo -e "${YELLOW}Step 3: Creating backup...${NC}"
echo -e "${BLUE}Backup file: $BACKUP_FILE${NC}"

# Create backup using pg_dump
# Options:
#   --no-owner: Don't output commands to set ownership
#   --no-acl: Don't output ACL (access control list) commands
#   --verbose: Verbose output
# Note: pg_dump includes both schema and data by default
if [ -n "$LOCAL_DB_URL" ]; then
    # Use connection string
    DUMP_CMD="pg_dump \"$LOCAL_DB_URL\""
else
    # Use psql parameters
    DUMP_CMD="pg_dump -U $LOCAL_DB_USER -d $LOCAL_DB_NAME"
fi

if eval "$DUMP_CMD" \
    --no-owner \
    --no-acl \
    --file="$BACKUP_FILE" \
    --verbose 2>&1 | grep -E "(dumping|ERROR|WARNING)" || true; then
    
    # Check if backup file was created and has content
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}Error: Backup file was not created!${NC}"
        exit 1
    fi
    
    if [ ! -s "$BACKUP_FILE" ]; then
        echo -e "${RED}Error: Backup file is empty!${NC}"
        exit 1
    fi
    
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Backup created successfully${NC}"
    echo -e "${BLUE}Backup size: $BACKUP_SIZE${NC}\n"
else
    BACKUP_EXIT_CODE=$?
    echo -e "${YELLOW}Warning: Backup completed with exit code: $BACKUP_EXIT_CODE${NC}"
    echo "Check the output above for any errors"
    
    # Still check if file exists
    if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
        echo -e "${RED}Error: Backup file is missing or empty!${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}Step 4: Verifying backup file...${NC}"

# Verify backup file format
if head -n 5 "$BACKUP_FILE" | grep -qE "(PostgreSQL|pg_dump|CREATE|INSERT|COPY|SET statement_timeout)"; then
    echo -e "${GREEN}✓ Backup file format is valid${NC}"
else
    echo -e "${YELLOW}Warning: Backup file doesn't look like a standard PostgreSQL dump${NC}"
    echo "File may still be valid, but please verify"
fi

# Count lines in backup file
LINE_COUNT=$(wc -l < "$BACKUP_FILE" | xargs)
echo -e "${BLUE}Backup file lines: $LINE_COUNT${NC}\n"

echo -e "${GREEN}=== Backup Complete! ===${NC}\n"
echo "Backup saved to: $BACKUP_FILE"
echo ""
echo "To restore this backup, use:"
echo "  ./scripts/restore-from-backup.sh $BACKUP_FILE"
echo ""
echo "Or manually:"
echo "  psql \"\$DATABASE_URL\" -f $BACKUP_FILE"
echo ""
echo -e "${BLUE}Note: Keep this backup file safe. You can use it to restore your database later.${NC}"

