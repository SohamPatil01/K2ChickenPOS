#!/bin/bash

# Safe migration script to add receivedQtyKg, receivedQtyPcs, and updatedAt columns
# to PurchaseOrderItem table without affecting existing data

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Safe Migration: Add PO Item Columns ===${NC}"
echo ""
echo "This migration will add the following columns to PurchaseOrderItem:"
echo "  - receivedQtyKg (nullable Float)"
echo "  - receivedQtyPcs (nullable Int)"
echo "  - updatedAt (DateTime with default)"
echo ""
echo -e "${YELLOW}This will NOT delete or modify any existing data.${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo "Please set it using one of these methods:"
    echo "  1. Export it: export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
    echo "  2. Or create a .env file in packages/db/ with: DATABASE_URL=..."
    echo ""
    exit 1
fi

# Extract database name from DATABASE_URL for confirmation
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
echo -e "${YELLOW}Target database: ${DB_NAME}${NC}"
echo ""

# Confirm before proceeding
read -p "Do you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${GREEN}Running migration...${NC}"
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
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
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

