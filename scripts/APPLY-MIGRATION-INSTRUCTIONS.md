# Safe Production Database Migration Instructions

## What This Migration Does

This migration adds two new columns to the `PurchaseOrderItem` table:
- `sinkageQtyKg` (DOUBLE PRECISION, nullable)
- `sinkageQtyPcs` (INTEGER, nullable)

## Safety Guarantees

✅ **NO DATA WILL BE DELETED**
✅ **NO DATA WILL BE MODIFIED**
✅ **Only adds new nullable columns**
✅ **Existing rows will have NULL in new columns (expected)**
✅ **Safe to run multiple times**

---

## Step-by-Step Instructions

### Step 1: Get Your Production Database URL

You mentioned: `postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true`

### Step 2: Run the Migration Script

Open your terminal and run:

```bash
# Set the database URL (use your production URL)
export DATABASE_URL="postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"

# Make the script executable
chmod +x scripts/apply-sinkage-migration-production.sh

# Run the migration
./scripts/apply-sinkage-migration-production.sh
```

### Step 3: Follow the Prompts

The script will:
1. ✓ Test database connection
2. ✓ Check if columns already exist
3. ✓ Show you what will be added
4. ✓ Ask for confirmation (type `yes`)
5. ✓ Apply the migration
6. ✓ Verify the changes

### Step 4: Verify Success

After the migration completes, you should see:
```
✅ Migration applied successfully!

New columns added:
  - PurchaseOrderItem.sinkageQtyKg (DOUBLE PRECISION, nullable)
  - PurchaseOrderItem.sinkageQtyPcs (INTEGER, nullable)

✓ No data was deleted or modified
✓ Existing rows have NULL values (expected)
```

---

## What If Something Goes Wrong?

**The migration is designed to be safe and non-destructive.**

If you see an error:
- ❌ Connection error: Check your DATABASE_URL
- ❌ Permission error: Ensure your database user has ALTER TABLE permission
- ❌ Columns already exist: Safe to ignore, migration already applied

To rollback (if needed, but not recommended):
```sql
-- Only if absolutely necessary
ALTER TABLE "PurchaseOrderItem" 
DROP COLUMN IF EXISTS "sinkageQtyKg",
DROP COLUMN IF EXISTS "sinkageQtyPcs";
```

---

## After Migration

Once the migration is complete, the PO Sinkage feature will work:
1. Create and finalize a Purchase Order
2. Click "Apply Sinkage" button
3. Enter sinkage amounts for each item
4. System will automatically deduct from inventory

---

## Need Help?

If you encounter any issues, the script will provide detailed error messages.
All operations are logged and can be reviewed.

