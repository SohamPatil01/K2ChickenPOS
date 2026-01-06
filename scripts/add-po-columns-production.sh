#!/bin/bash

# Safe migration script to add receivedQtyKg, receivedQtyPcs, and updatedAt columns
# to PurchaseOrderItem table on PRODUCTION database without affecting existing data

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Production Migration: Add PO Item Columns ===${NC}"
echo ""
echo "This migration will add the following columns to PurchaseOrderItem:"
echo "  - receivedQtyKg (nullable Float)"
echo "  - receivedQtyPcs (nullable Int)"
echo "  - updatedAt (DateTime with default)"
echo ""
echo -e "${RED}⚠️  WARNING: This will run on PRODUCTION database!${NC}"
echo -e "${YELLOW}This will NOT delete or modify any existing data.${NC}"
echo ""

# Check if DATABASE_URL is provided as argument or environment variable
if [ -n "$1" ]; then
    export DATABASE_URL="$1"
    echo -e "${GREEN}Using DATABASE_URL from command line argument${NC}"
elif [ -n "$DATABASE_URL" ]; then
    echo -e "${GREEN}Using DATABASE_URL from environment variable${NC}"
else
    echo -e "${RED}Error: DATABASE_URL is required${NC}"
    echo ""
    echo "Usage:"
    echo "  $0 'postgresql://user:pass@host:port/dbname'"
    echo ""
    echo "Or set it as environment variable:"
    echo "  export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
    echo "  $0"
    echo ""
    echo "To get your production DATABASE_URL:"
    echo "  1. Go to Vercel Dashboard → Your API Project → Settings → Environment Variables"
    echo "  2. Find DATABASE_URL and copy it"
    echo "  3. Or go to Vercel Dashboard → Storage → Your Postgres DB → .env.local tab"
    echo ""
    exit 1
fi

# Extract database name from DATABASE_URL for confirmation
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')

echo -e "${YELLOW}Target database: ${DB_NAME}${NC}"
echo -e "${YELLOW}Database host: ${DB_HOST}${NC}"
echo ""

# Double confirmation for production
echo -e "${RED}⚠️  PRODUCTION DATABASE CONFIRMATION ⚠️${NC}"
read -p "Are you SURE you want to run this on PRODUCTION? Type 'yes' to confirm: " confirm1
if [ "$confirm1" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

read -p "Type 'PRODUCTION' to confirm again: " confirm2
if [ "$confirm2" != "PRODUCTION" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${GREEN}Running migration on production...${NC}"
echo ""

# Run the migration SQL
psql "$DATABASE_URL" << 'EOF'
-- Add receivedQtyKg column (nullable Float)
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "receivedQtyKg" DOUBLE PRECISION;

-- Add receivedQtyPcs column (nullable Int)
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "receivedQtyPcs" INTEGER;

-- Add updatedAt column (nullable first, then we'll set values)
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Set updatedAt to createdAt for existing rows (if updatedAt is null)
UPDATE "PurchaseOrderItem" 
SET "updatedAt" = "createdAt" 
WHERE "updatedAt" IS NULL;

-- Make updatedAt NOT NULL and add default (after setting values for existing rows)
DO $$
BEGIN
    -- Only alter if column exists and is nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PurchaseOrderItem' 
        AND column_name = 'updatedAt' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "PurchaseOrderItem" 
        ALTER COLUMN "updatedAt" SET NOT NULL,
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Migration completed successfully on PRODUCTION!${NC}"
    echo ""
    echo "The following columns have been added:"
    echo "  ✓ receivedQtyKg (nullable)"
    echo "  ✓ receivedQtyPcs (nullable)"
    echo "  ✓ updatedAt (with default value)"
    echo ""
    echo "All existing data has been preserved."
else
    echo ""
    echo -e "${RED}✗ Migration failed. Please check the error above.${NC}"
    exit 1
fi

