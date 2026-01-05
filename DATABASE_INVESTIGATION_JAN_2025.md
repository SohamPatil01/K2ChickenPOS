# Database Investigation: Missing Data from January 1st, 2025

## Investigation Summary

Using Vercel MCP tools, I've investigated the database changes and missing data issue. Here's what I found:

## Key Findings

### 1. **Previous Data Deletion Incident**

- There's documentation (`WHY_DATA_WAS_DELETED.md`) indicating a previous incident where the seed script deleted all production data
- The seed script (`packages/db/prisma/seed.ts`) was designed to delete ALL data before seeding
- Safety checks were added in commit `1384657` to prevent this, but this was AFTER a deletion occurred

### 2. **Current Seed Script Protection**

The seed script now has safety checks that:

- Detect production databases (Supabase, Vercel, Neon)
- Block execution on production unless `FORCE_SEED=true` is set
- Show clear error messages before exiting

### 3. **Vercel Deployment Analysis**

- **API Project**: `k2-chicken-pos-api` (ID: `prj_POxbF0F1hfW4la556XEamjXhMIvj`)
- **Latest Deployment**: `dpl_Hw6BuWJ14YPBoggXmuG8PRStLekk` (commit 1384657)
  - This deployment added safety checks to prevent seed script from running on production
  - Build logs show no seed script execution during deployment
- **No deployments found on January 1st, 2025** that would explain the data loss

### 4. **Possible Causes for Missing Data from Jan 1st**

#### Scenario A: Seed Script Was Run (Most Likely)

- Someone may have run `pnpm db:seed` on or around January 1st, 2025
- This would have deleted ALL data, including data from January 1st onwards
- The seed script deletes:
  - All Sales
  - All Payments
  - All Customers
  - All Products
  - All Inventory Ledger entries
  - All other business data

#### Scenario B: Database Restore/Rollback

- Supabase database may have been restored to a point before January 1st
- This would explain why data from Jan 1st onwards is missing
- Older data would still exist

#### Scenario C: Manual Deletion Script

- One of the deletion scripts may have been run:
  - `delete-all-sales.ts`
  - `delete-all-products.ts`
  - `delete-inventory-items.ts`

## Investigation Steps Taken

1. ✅ Checked Vercel deployments around January 1st, 2025
2. ✅ Reviewed seed script safety mechanisms
3. ✅ Analyzed build logs for database operations
4. ✅ Checked for date-based filters in API routes (none found that would exclude Jan 1st data)

## Recommended Actions

### Immediate: Check Supabase for Recovery Options

1. **Check Supabase Point-in-Time Recovery (PITR)**

   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Navigate to: **Settings** → **Database** → **Backups**
   - Look for automatic backups or PITR options
   - If available, restore to a point just before January 1st, 2025

2. **Check Supabase Activity Logs**

   - Go to Supabase Dashboard → Your Project
   - Check **Logs** or **Activity** section
   - Look for DELETE operations around January 1st, 2025
   - This will show what actually deleted the data

3. **Check Database Connection History**
   - Review who had access to the database around January 1st
   - Check if any scripts were run manually

### Verify Current Database State

Run these queries in Supabase SQL Editor to check what data exists:

```sql
-- Check latest sale date
SELECT MAX("createdAt") as latest_sale_date, COUNT(*) as total_sales
FROM "Sale";

-- Check sales by date (to see where data stops)
SELECT
  DATE("createdAt") as sale_date,
  COUNT(*) as sale_count
FROM "Sale"
GROUP BY DATE("createdAt")
ORDER BY sale_date DESC
LIMIT 30;

-- Check if any data exists after Jan 1, 2025
SELECT COUNT(*) as count_after_jan1
FROM "Sale"
WHERE "createdAt" >= '2025-01-01';

-- Check inventory ledger entries
SELECT MAX("createdAt") as latest_inventory_date, COUNT(*) as total_entries
FROM "InventoryLedger";
```

### Prevention Measures

1. **Enable Supabase Backups**

   - If on Pro plan: Enable Point-in-Time Recovery
   - Set up daily automated backups
   - Export data regularly using `pg_dump`

2. **Audit Database Access**

   - Review who has access to run scripts
   - Consider read-only access for most users
   - Log all database operations

3. **Add Monitoring**
   - Set up alerts for large DELETE operations
   - Monitor database size changes
   - Track when seed/reset scripts are run

## Recovery Options

### Option 1: Restore from Local Backup File (If You Have One) ⭐

If you have a local SQL backup file, this is the fastest way to restore:

```bash
# Navigate to project root
cd /Users/soham/Desktop/K2POS/K2ChickenPOS

# Set your Supabase database URL (NON-POOLING connection)
export SUPABASE_DATABASE_URL="postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Run the restore script
./scripts/restore-from-backup.sh /path/to/your/backup.sql
```

**The restore script will:**

- Create a backup of current state before restoring (safety measure)
- Clear all existing data
- Restore from your backup file
- Verify the restored data

See `DATABASE_RESTORE_GUIDE.md` for detailed instructions.

### Option 2: Restore from Supabase Backup (Best Option if Available)

If Supabase has backups:

1. Go to Supabase Dashboard → Settings → Database → Backups
2. Find a backup from before January 1st, 2025
3. Restore the database to that point
4. **Note**: This will restore ALL data to that point (you'll lose any data created after the backup)

### Option 2: Check for Data in Other Sources

- Check if data was synced to IndexedDB (offline storage)
- Check application logs for data that was created
- Check if there are any export files or backups

### Option 3: Recreate Missing Data

If no backups exist:

- Manually recreate the data that was lost
- Use the application to create new sales, customers, etc.
- This is time-consuming but may be necessary

## Next Steps

1. **Immediately check Supabase Dashboard** for backup/restore options
2. **Run the SQL queries above** to verify current database state
3. **Check Supabase activity logs** to see what happened on January 1st
4. **Document what data was lost** for recovery planning
5. **Set up regular backups** to prevent future data loss

## Questions to Answer

- [ ] Does Supabase have backups available?
- [ ] What does the Supabase activity log show for January 1st?
- [ ] Who had database access around that time?
- [ ] Was the seed script run manually?
- [ ] Was there a database restore operation?

## Contact Information

If you need help with:

- **Supabase Support**: Check Supabase dashboard for support options
- **Database Recovery**: Follow the steps in `DATABASE_RESTORE_GUIDE.md`
- **Preventing Future Issues**: Review `WHY_DATA_WAS_DELETED.md` for prevention strategies

---

**Investigation Date**: January 2025  
**Investigated By**: Vercel MCP Tools  
**Status**: Awaiting Supabase backup/activity log review
