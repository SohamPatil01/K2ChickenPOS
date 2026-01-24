#!/bin/bash

# Safe Production Migration Script: Add Sinkage Fields to PurchaseOrderItem
# This script safely adds new columns to PRODUCTION database without deleting or overwriting existing data
# 
# USAGE:
#   export DATABASE_URL="your-production-database-url"
#   ./scripts/apply-sinkage-migration-production.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================="
echo "Production Migration: Add Sinkage Fields"
echo "==========================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo "Please set your PRODUCTION database URL:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    echo ""
    echo "For Vercel, you can get it from:"
    echo "  - Vercel Dashboard > Your Project > Settings > Environment Variables"
    echo "  - Or from your Vercel CLI: vercel env pull"
    echo ""
    exit 1
fi

# Extract database name for confirmation
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p' || echo "unknown")
echo -e "${YELLOW}⚠️  PRODUCTION DATABASE DETECTED${NC}"
echo -e "Database: ${DB_NAME}"
echo ""

# Safety check - warn user
echo -e "${YELLOW}This migration will:${NC}"
echo "  ✅ Add 'sinkageQtyKg' column (nullable, safe)"
echo "  ✅ Add 'sinkageQtyPcs' column (nullable, safe)"
echo "  ✅ Use 'IF NOT EXISTS' - safe to run multiple times"
echo "  ✅ NO data will be deleted or modified"
echo "  ✅ Existing rows will have NULL values (expected)"
echo ""
echo -e "${RED}⚠️  WARNING: You are about to modify the PRODUCTION database!${NC}"
echo ""
read -p "Type 'yes' to confirm you want to proceed: " confirm

if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Testing database connection...${NC}"

# Clean DATABASE_URL for psql (remove query parameters)
CLEAN_DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/\?.*//')

# Test connection
if ! psql "$CLEAN_DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Cannot connect to database${NC}"
    echo "Please check your DATABASE_URL"
    exit 1
fi

echo -e "${GREEN}✓ Connection successful${NC}"
echo ""

# Check if columns already exist
echo "Checking if columns already exist..."
EXISTING_COLUMNS=$(psql "$CLEAN_DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'PurchaseOrderItem' 
    AND column_name IN ('sinkageQtyKg', 'sinkageQtyPcs');
" 2>/dev/null | xargs || echo "0")

if [ "$EXISTING_COLUMNS" = "2" ]; then
    echo -e "${YELLOW}⚠️  Columns already exist. Migration may have already been applied.${NC}"
    echo "The migration uses 'IF NOT EXISTS' so it's safe to run again."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled."
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}Applying migration...${NC}"
echo ""

# Apply migration using the SQL file
psql "$CLEAN_DATABASE_URL" << 'EOF'
-- Migration: Add sinkage fields to PurchaseOrderItem
-- This is SAFE - uses IF NOT EXISTS and doesn't modify existing data

-- Add sinkage fields to PurchaseOrderItem table
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "sinkageQtyKg" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sinkageQtyPcs" INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN "PurchaseOrderItem"."sinkageQtyKg" IS 'Sinkage/wastage during receiving (in KG)';
COMMENT ON COLUMN "PurchaseOrderItem"."sinkageQtyPcs" IS 'Sinkage/wastage during receiving (in pieces)';
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration applied successfully!${NC}"
    echo ""
    echo "New columns added:"
    echo "  - PurchaseOrderItem.sinkageQtyKg (DOUBLE PRECISION, nullable)"
    echo "  - PurchaseOrderItem.sinkageQtyPcs (INTEGER, nullable)"
    echo ""
    echo -e "${GREEN}✓ No data was deleted or modified${NC}"
    echo -e "${GREEN}✓ Existing rows have NULL values (expected)${NC}"
    echo ""
    echo "You can now use the sinkage calculation feature in Purchase Orders."
    echo ""
    echo -e "${BLUE}Verifying columns exist...${NC}"
    psql "$CLEAN_DATABASE_URL" -c "\d \"PurchaseOrderItem\"" | grep -E 'sinkageQtyKg|sinkageQtyPcs' || echo "Columns may not be visible in this view, but they exist."
    echo ""
    echo -e "${GREEN}Migration complete!${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration failed. Please check the error above.${NC}"
    echo ""
    echo "Common issues:"
    echo "  - Database connection failed"
    echo "  - Insufficient permissions"
    echo "  - Database URL format incorrect"
    exit 1
fi

