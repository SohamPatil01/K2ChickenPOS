#!/bin/bash

# Automated Production Migration Script
# This script will help you get the DATABASE_URL and run the migration

set -e

echo "========================================="
echo "Production Database Migration"
echo "========================================="
echo ""

# Check if DATABASE_URL is already set
if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL is already set in environment"
    echo "Using existing DATABASE_URL..."
    echo ""
else
    echo "📋 DATABASE_URL not found. Let's get it from Vercel or enter it manually."
    echo ""
    echo "Option 1: Get from Vercel Dashboard"
    echo "  1. Go to https://vercel.com/dashboard"
    echo "  2. Select your API project (k2-chicken-pos-api)"
    echo "  3. Go to Settings → Environment Variables"
    echo "  4. Find DATABASE_URL and copy it"
    echo ""
    echo "Option 2: Get from Vercel Storage"
    echo "  1. Go to https://vercel.com/dashboard"
    echo "  2. Select your API project"
    echo "  3. Go to Storage tab"
    echo "  4. Click on your Postgres database"
    echo "  5. Go to .env.local tab"
    echo "  6. Copy POSTGRES_URL or DATABASE_URL"
    echo ""
    
    read -p "Paste your DATABASE_URL here: " db_url
    if [ -z "$db_url" ]; then
        echo "❌ DATABASE_URL is required. Exiting."
        exit 1
    fi
    export DATABASE_URL="$db_url"
    echo "✅ DATABASE_URL set!"
    echo ""
fi

# Test connection
echo "🧪 Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Connection successful!"
    echo ""
else
    echo "❌ Connection failed. Please check your DATABASE_URL."
    echo "   Make sure it's in format: postgres://user:password@host:port/database"
    exit 1
fi

# Show current database info
echo "📊 Current database information:"
psql "$DATABASE_URL" -c "SELECT current_database(), version();" 2>/dev/null || true
echo ""

# Confirm before proceeding
echo "⚠️  This will add the following to your production database:"
echo "   - timezone column to Store table"
echo "   - businessDate column to Sale table"
echo "   - businessDate column to Shift table"
echo "   - Index on [storeId, businessDate] for Sale table"
echo ""
echo "✅ This migration is safe and won't affect existing data."
echo ""

read -p "Do you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "🚀 Running migration..."
echo ""

# Run the migration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql "$DATABASE_URL" -f "$SCRIPT_DIR/migrate-production-safe.sql"

echo ""
echo "========================================="
echo "✅ Migration completed successfully!"
echo "========================================="
echo ""
echo "Verification results:"
psql "$DATABASE_URL" -c "
SELECT 
    'Store.timezone' as column_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Store' AND column_name = 'timezone'
    ) as exists
UNION ALL
SELECT 
    'Sale.businessDate',
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Sale' AND column_name = 'businessDate'
    )
UNION ALL
SELECT 
    'Shift.businessDate',
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Shift' AND column_name = 'businessDate'
    )
UNION ALL
SELECT 
    'Sale_storeId_businessDate_idx',
    EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'Sale' 
        AND indexname = 'Sale_storeId_businessDate_idx'
    );
"

echo ""
echo "🎉 All done! Your production database is now updated."
echo ""
echo "Next steps:"
echo "1. The Prisma client has already been regenerated"
echo "2. Your code changes are already deployed"
echo "3. The application should now work without errors"
echo ""

