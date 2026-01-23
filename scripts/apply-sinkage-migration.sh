#!/bin/bash

# Safe Migration Script: Add Sinkage Fields to PurchaseOrderItem
# This script safely adds new columns without deleting or overwriting existing data

set -e

echo "=========================================="
echo "Applying Sinkage Fields Migration"
echo "=========================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set it first:"
    echo "  export DATABASE_URL='your-connection-string'"
    echo ""
    echo "Or use the helper script:"
    echo "  ./scripts/set-database-url.sh"
    exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Verify connection
echo "Testing database connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ ERROR: Cannot connect to database"
    echo "Please check your DATABASE_URL"
    exit 1
fi

echo "✓ Database connection successful"
echo ""

# Check if columns already exist
echo "Checking if columns already exist..."
EXISTING_COLUMNS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_name = 'PurchaseOrderItem' 
    AND column_name IN ('sinkageQtyKg', 'sinkageQtyPcs');
" | xargs)

if [ "$EXISTING_COLUMNS" = "2" ]; then
    echo "⚠️  WARNING: Columns already exist. Migration may have already been applied."
    echo "The migration uses 'IF NOT EXISTS' so it's safe to run again."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled."
        exit 0
    fi
fi

echo ""
echo "Applying migration..."
echo "This will add two new columns: sinkageQtyKg and sinkageQtyPcs"
echo "No existing data will be modified or deleted."
echo ""

# Apply migration
psql "$DATABASE_URL" -f packages/db/prisma/migrations/add_sinkage_fields_to_po_items.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "New columns added:"
    echo "  - PurchaseOrderItem.sinkageQtyKg (DOUBLE PRECISION)"
    echo "  - PurchaseOrderItem.sinkageQtyPcs (INTEGER)"
    echo ""
    echo "You can now use the sinkage calculation feature in Purchase Orders."
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi

