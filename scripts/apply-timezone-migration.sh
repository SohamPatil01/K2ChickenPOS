#!/bin/bash

# Script to apply the timezone and businessDate migration directly to the database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Applying Timezone and BusinessDate Migration ===${NC}\n"

# Database configuration
DB_NAME="${LOCAL_DB_NAME:-azela_pos}"
DB_USER="${LOCAL_DB_USER:-postgres}"

# Allow override via environment variable
if [ -n "$DATABASE_URL" ]; then
    echo -e "${BLUE}Using DATABASE_URL from environment${NC}\n"
    DB_URL="$DATABASE_URL"
else
    echo -e "${BLUE}Using default local connection (postgres@localhost:5432/${DB_NAME})${NC}\n"
    DB_URL=""
fi

# SQL to apply
SQL="
-- Add timezone column to Store table (safe: additive only)
ALTER TABLE \"Store\" ADD COLUMN IF NOT EXISTS \"timezone\" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- Add businessDate column to Sale table (safe: nullable, no data loss)
ALTER TABLE \"Sale\" ADD COLUMN IF NOT EXISTS \"businessDate\" TIMESTAMP(3);

-- Add businessDate column to Shift table (safe: nullable, no data loss)
ALTER TABLE \"Shift\" ADD COLUMN IF NOT EXISTS \"businessDate\" TIMESTAMP(3);

-- Add index for performance: (storeId, businessDate) on Sale
CREATE INDEX IF NOT EXISTS \"Sale_storeId_businessDate_idx\" ON \"Sale\"(\"storeId\", \"businessDate\");
"

echo -e "${YELLOW}Applying migration...${NC}"

if [ -n "$DB_URL" ]; then
    # Use connection string
    echo "$SQL" | psql "$DB_URL"
else
    # Use psql parameters
    echo "$SQL" | psql -U "$DB_USER" -d "$DB_NAME"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration applied successfully!${NC}\n"
    echo -e "${BLUE}Note: Existing records will have NULL businessDate initially.${NC}"
    echo -e "${BLUE}You may want to run a backfill script to populate businessDate for existing records.${NC}"
else
    echo -e "${RED}✗ Migration failed!${NC}"
    exit 1
fi

