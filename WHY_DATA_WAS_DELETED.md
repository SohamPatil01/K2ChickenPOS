# Why Your Supabase Database Data Was Deleted

## Root Cause

The **seed script** (`packages/db/prisma/seed.ts`) is designed to **delete ALL existing data** before seeding fresh data. This is a common pattern for development databases but extremely dangerous for production.

## What Happened

The seed script performs these operations in order:

1. **Deletes ALL data from these tables:**
   - Stores
   - Users
   - Products
   - Categories
   - Sales
   - Payments
   - Customers
   - Inventory Ledger
   - And all other tables

2. **Then seeds fresh data:**
   - Creates default stores
   - Creates test users
   - Creates sample products
   - Creates categories

## How It Could Have Been Triggered

### Most Likely Scenarios:

1. **Manual Execution:**
   - Someone ran `pnpm db:seed` or `pnpm --filter @azela-pos/db seed`
   - This could have been:
     - During initial setup following documentation
     - Accidentally thinking it would just add data
     - Testing/debugging

2. **Following Setup Instructions:**
   - The `SUPABASE_SETUP.md` file includes:
     ```bash
     pnpm db:seed
     ```
   - If someone followed these instructions on a production database, it would delete everything

3. **Copy-Paste Error:**
   - Someone might have copied commands from documentation meant for fresh setup
   - Ran them on the production database

## Evidence

- **Git History:** No recent commits show seed being run automatically
- **Vercel Config:** The `vercel.json` does NOT run seed automatically (good!)
- **Recent Safety Fix:** Commit `1384657` added safety checks to prevent this, but it was added AFTER the deletion happened

## The Problem with the Seed Script

The seed script has this dangerous code:

```typescript
// Clear existing data (for development)
await prisma.store.deleteMany();
await prisma.user.deleteMany();
await prisma.product.deleteMany();
// ... deletes ALL tables
```

**This is fine for development** but **catastrophic for production**.

## What We've Done to Prevent This

1. **Added Safety Checks** (commit 1384657):
   - Seed script now detects production databases
   - Blocks execution on Supabase/Vercel/Neon databases
   - Requires `FORCE_SEED=true` to override (not recommended)

2. **Created Documentation:**
   - `DATABASE_RESTORE_GUIDE.md` - How to recover from data loss
   - This document explaining what happened

## How to Prevent This in the Future

### 1. **Never Run Seed on Production**
   - Seed script is ONLY for development
   - Use migrations or manual data entry for production

### 2. **Set Up Regular Backups**
   - Enable Supabase Point-in-Time Recovery (Pro plan)
   - Or set up daily automated backups
   - Export data regularly: `pg_dump > backup.sql`

### 3. **Separate Development and Production**
   - Use different databases for dev and production
   - Never use production DATABASE_URL for development scripts

### 4. **Add Confirmation Prompts**
   - Consider adding interactive confirmation before deleting data
   - Show data counts before deletion

### 5. **Create Separate Scripts**
   - `seed.ts` - For development only (deletes + seeds)
   - `seed-production.ts` - For production (only adds, never deletes)
   - `reset.ts` - Explicitly for resetting (with warnings)

## Recovery Options

1. **Check Supabase Backups:**
   - Go to Supabase Dashboard → Settings → Database → Backups
   - Restore from a point before deletion

2. **Re-seed (if no backup):**
   - Run `pnpm db:seed` (already done)
   - Recreate your custom data manually

3. **Set Up Backups Going Forward:**
   - Enable automatic backups in Supabase
   - Export data regularly

## Lessons Learned

1. **Seed scripts should NEVER delete production data**
2. **Always have backups** before running destructive operations
3. **Separate development and production workflows**
4. **Add safety checks** to prevent accidental data loss
5. **Document dangerous operations** clearly

## Current Status

✅ **Fixed:** Seed script now has safety checks  
✅ **Restored:** Database has been re-seeded with initial data  
⚠️ **Action Needed:** Set up regular backups to prevent future data loss

