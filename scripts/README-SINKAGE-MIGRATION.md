# Production Migration: Add Sinkage Fields

## Overview

This migration adds two new columns to the `PurchaseOrderItem` table:
- `sinkageQtyKg` (DOUBLE PRECISION, nullable)
- `sinkageQtyPcs` (INTEGER, nullable)

## ✅ Safety Features

- **100% Safe**: Uses `ADD COLUMN IF NOT EXISTS` - won't fail if columns already exist
- **No Data Loss**: Only adds new columns, doesn't modify or delete existing data
- **Nullable Columns**: Existing rows will have NULL values (expected behavior)
- **Idempotent**: Can be run multiple times safely

## 🚀 How to Apply to Production

### Option 1: Using the Script (Recommended)

```bash
# 1. Set your production DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# 2. Run the migration script
./scripts/apply-sinkage-migration-production.sh
```

### Option 2: Manual SQL Execution

1. Connect to your production database (using psql, pgAdmin, or your preferred tool)
2. Run the SQL from `packages/db/prisma/migrations/add_sinkage_fields_to_po_items.sql`:

```sql
ALTER TABLE "PurchaseOrderItem" 
ADD COLUMN IF NOT EXISTS "sinkageQtyKg" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sinkageQtyPcs" INTEGER;
```

### Option 3: Using Vercel Database

If your database is on Vercel:

1. **Get your database URL from Vercel:**
   ```bash
   # Using Vercel CLI
   vercel env pull
   # Look for DATABASE_URL in .env.local
   ```

2. **Or from Vercel Dashboard:**
   - Go to your project → Settings → Environment Variables
   - Copy the `DATABASE_URL` value

3. **Run the migration:**
   ```bash
   export DATABASE_URL="your-vercel-database-url"
   ./scripts/apply-sinkage-migration-production.sh
   ```

## 🔍 Verification

After running the migration, verify it worked:

```sql
-- Check if columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'PurchaseOrderItem'
AND column_name IN ('sinkageQtyKg', 'sinkageQtyPcs');
```

You should see 2 rows returned.

## 📝 What This Enables

After this migration:
- ✅ Purchase Orders can track sinkage/wastage during receiving
- ✅ Sinkage quantities can be manually entered after PO finalization
- ✅ Inventory will be automatically adjusted when sinkage is applied
- ✅ Historical PO data remains intact

## ⚠️ Important Notes

- **No Downtime Required**: This migration is non-blocking
- **Backward Compatible**: The code handles missing columns gracefully
- **No Rollback Needed**: If something goes wrong, the columns can be dropped later (but this shouldn't be necessary)

## 🆘 Troubleshooting

### Error: "column already exists"
- This is fine! The migration uses `IF NOT EXISTS`, so it's safe to run multiple times
- Your database already has the columns

### Error: "permission denied"
- Make sure your database user has `ALTER TABLE` permissions
- Contact your database administrator if needed

### Error: "cannot connect to database"
- Verify your `DATABASE_URL` is correct
- Check network connectivity
- Ensure database is accessible from your location

## 📞 Support

If you encounter any issues, check:
1. Database connection string format
2. User permissions
3. Network/firewall settings
4. Database logs for detailed error messages

