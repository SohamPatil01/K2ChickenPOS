# Production Database Migration Guide

## Overview

This migration adds the missing `timezone` and `businessDate` columns to the production database. The migration is **safe** and **idempotent** (can be run multiple times without issues).

## What This Migration Does

1. **Adds `timezone` column to `Store` table**
   - Type: `TEXT` (nullable)
   - Default: `'Asia/Kolkata'`
   - Existing rows are updated with the default value

2. **Adds `businessDate` column to `Sale` table**
   - Type: `TIMESTAMP(3)` (nullable)
   - Existing rows remain NULL (intentional - this is optional)

3. **Adds `businessDate` column to `Shift` table**
   - Type: `TIMESTAMP(3)` (nullable)
   - Existing rows remain NULL (intentional - this is optional)

4. **Adds index on `[storeId, businessDate]` for `Sale` table**
   - Improves query performance for business date filtering

## Safety Features

- ✅ **Idempotent**: Can be run multiple times safely
- ✅ **Non-destructive**: Doesn't modify existing data
- ✅ **Nullable columns**: Won't break existing queries
- ✅ **Checks before adding**: Verifies columns don't exist before creating

## How to Run

### Option 1: Using the Script (Recommended)

```bash
# Set your production database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run the migration script
./scripts/apply-production-migration.sh
```

### Option 2: Manual SQL Execution

```bash
# Connect to your production database and run:
psql $DATABASE_URL -f scripts/migrate-production-safe.sql
```

### Option 3: Using a Database Client

1. Connect to your production database
2. Open `scripts/migrate-production-safe.sql`
3. Execute the SQL statements

## Verification

After running the migration, verify the changes:

```sql
-- Check if columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('Store', 'Sale', 'Shift')
AND column_name IN ('timezone', 'businessDate');

-- Check if index exists
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'Sale'
AND indexname = 'Sale_storeId_businessDate_idx';
```

## After Migration

1. **Regenerate Prisma Client**:
   ```bash
   cd packages/db
   npm run generate
   ```

2. **Update the schema** (already done):
   - The `businessDate` index is now uncommented in `schema.prisma`
   - The `timezone` field is already defined as optional

3. **Deploy the updated code**:
   - The code changes are already committed
   - After migration, the application will work correctly

## Rollback (if needed)

If you need to rollback (not recommended, but possible):

```sql
-- Remove the index
DROP INDEX IF EXISTS "Sale_storeId_businessDate_idx";

-- Remove the columns (only if no data depends on them)
ALTER TABLE "Sale" DROP COLUMN IF EXISTS "businessDate";
ALTER TABLE "Shift" DROP COLUMN IF EXISTS "businessDate";
ALTER TABLE "Store" DROP COLUMN IF EXISTS "timezone";
```

## Notes

- The migration is designed to be **non-breaking**
- Existing queries will continue to work
- New columns are nullable, so no data migration is required
- The `timezone` column gets a default value for existing rows
- The `businessDate` columns remain NULL for existing rows (as intended)

