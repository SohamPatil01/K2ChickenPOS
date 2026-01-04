# Database Restore Guide - Recovering Deleted Data

## ⚠️ Important: Your Data May Be Recoverable

If your Supabase database was recently deleted, you may be able to restore it using Supabase's backup features.

## Option 1: Supabase Point-in-Time Recovery (PITR)

Supabase Pro plans and above have **Point-in-Time Recovery** which allows you to restore your database to any point in time.

### Steps:

1. **Go to Supabase Dashboard**
   - Visit [supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Check for Backups**
   - Go to **Settings** → **Database**
   - Look for **Backups** or **Point-in-Time Recovery** section
   - Check if automatic backups are enabled

3. **Restore from Backup**
   - If backups are available, you can restore to a point before the deletion
   - This will restore ALL data to that point in time

## Option 2: Check Supabase Activity Logs

1. **Go to Supabase Dashboard** → Your Project
2. **Check Activity/Logs**
   - Look for any recent operations that might have deleted data
   - Check when the deletion occurred

## Option 3: Re-seed the Database (If No Backup Available)

If you cannot restore from backup, you'll need to re-seed the database:

### Step 1: Run Migrations (if needed)

```bash
# Set DATABASE_URL to NON-POOLING connection (for migrations)
export DATABASE_URL="postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Run migrations to ensure all tables exist
pnpm db:migrate:deploy
```

### Step 2: Seed the Database

```bash
# Make sure DATABASE_URL is set (use NON-POOLING for seeding)
export DATABASE_URL="postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Run seed script (this will create stores, users, products, etc.)
pnpm db:seed
```

**⚠️ WARNING**: The seed script will DELETE all existing data before seeding. Only run this if you're sure you want to start fresh.

## Option 4: Manual Data Entry

If you had important production data that wasn't backed up:

1. **Recreate Stores**
   - Go to your app and create stores manually
   - Or use the Supabase dashboard to insert store records

2. **Recreate Users**
   - Create users through the app login/registration
   - Or insert directly into the database

3. **Recreate Products**
   - Add products through the POS interface
   - Or bulk import if you have product data

## Prevention: Make Seed Script Safer

The current seed script (`packages/db/prisma/seed.ts`) deletes ALL data before seeding. This is dangerous for production databases.

### Recommended Changes:

1. **Add a safety check** to prevent running on production
2. **Add confirmation prompt** before deleting data
3. **Create a separate "reset" script** for clearing data
4. **Keep seed script for development only**

## Check What Happened

To understand what deleted your data:

1. **Check if seed script was run**:
   ```bash
   # Check git history for recent seed runs
   git log --all --grep="seed" --oneline
   ```

2. **Check Supabase logs**:
   - Go to Supabase Dashboard → Logs
   - Look for DELETE operations around the time data disappeared

3. **Check Vercel deployment logs**:
   - Go to Vercel → Your API Project → Deployments
   - Check if any deployment ran seed scripts

## Immediate Actions

1. **Stop any running seed/reset scripts**
2. **Check Supabase for backups** (if available)
3. **Document what data was lost** (for recovery planning)
4. **Set up regular backups** going forward

## Setting Up Regular Backups

### For Supabase:

1. **Enable Point-in-Time Recovery** (Pro plan)
2. **Set up daily backups** in Supabase settings
3. **Export data regularly** using:
   ```bash
   pg_dump "your-connection-string" > backup.sql
   ```

### For Local Backups:

Create a backup script:

```bash
#!/bin/bash
# backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump "$DATABASE_URL" > "backup_${DATE}.sql"
echo "Backup created: backup_${DATE}.sql"
```

## Next Steps

1. **Check Supabase Dashboard** for backup/restore options
2. **If backups exist**: Restore immediately
3. **If no backups**: Re-seed database and start fresh
4. **Set up regular backups** to prevent this in the future

