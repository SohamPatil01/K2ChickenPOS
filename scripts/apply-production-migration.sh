#!/bin/bash

# Safe Production Migration Script
# This script applies the migration to add timezone and businessDate columns
# It's safe to run multiple times (idempotent)

set -e

echo "========================================="
echo "Production Database Migration Script"
echo "========================================="
echo ""
echo "This script will:"
echo "1. Add 'timezone' column to Store table (nullable, default: 'Asia/Kolkata')"
echo "2. Add 'businessDate' column to Sale table (nullable)"
echo "3. Add 'businessDate' column to Shift table (nullable)"
echo "4. Add index on [storeId, businessDate] for Sale table"
echo ""
echo "All changes are safe and won't affect existing data."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set."
    echo "Please set it before running this script:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

# Confirm before proceeding
read -p "Do you want to proceed with the migration? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Applying migration..."
echo ""

# Run the SQL migration
psql "$DATABASE_URL" -f "$(dirname "$0")/migrate-production-safe.sql"

echo ""
echo "========================================="
echo "Migration completed successfully!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Regenerate Prisma client: cd packages/db && npm run generate"
echo "2. Test the application to ensure everything works"
echo ""

