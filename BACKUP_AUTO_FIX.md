# 🔧 Automatic Backup Not Working - Fix Guide

## Quick Diagnosis

Run the diagnostic script:
```bash
./scripts/diagnose-backup.sh
```

## Common Issues & Solutions

### 1. **Cron Job Not Active in Vercel**

**Symptom**: Backups never run automatically

**Check**:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project → **Settings** → **Cron Jobs**
3. Look for: `/api/v1/backup/create` with schedule `0 15 * * *`

**Fix**:
- If cron job is missing, it means `vercel.json` changes haven't been deployed
- Commit and push your changes:
  ```bash
  git add apps/api/vercel.json apps/api/src/routes/backup.ts
  git commit -m "Fix automatic backup configuration"
  git push
  ```
- Or deploy manually:
  ```bash
  cd apps/api
  vercel --prod
  ```

### 2. **Vercel Plan Doesn't Support Cron Jobs**

**Symptom**: Cron job shows as "Not Available" or doesn't appear

**Check**:
- Go to Vercel Dashboard → Project → Settings → Plan
- Verify you're on **Hobby plan ($20/month)** or higher

**Fix**:
- Upgrade to Hobby plan or Pro plan
- Free plan does NOT support cron jobs

### 3. **Authentication Failing**

**Symptom**: Backups fail with 401 Unauthorized

**Check**:
- Test the cron detection endpoint:
  ```bash
  curl https://your-api.vercel.app/api/v1/backup/test-cron
  ```
- Check Vercel function logs for authentication errors

**Fix**:
- The updated code now handles Vercel cron authentication more reliably
- If still failing, check that `x-vercel-cron` header is being sent
- You can temporarily disable authentication by not setting `BACKUP_SECRET` (not recommended for production)

### 4. **Missing Environment Variables**

**Symptom**: Backups fail with storage errors

**Required Variables** (set in Vercel Dashboard → Settings → Environment Variables):
- `DATABASE_URL` - Your PostgreSQL connection string
- `BACKUP_STORAGE_METHOD` - Set to `vercel-blob` (default) or `s3`
- `BLOB_READ_WRITE_TOKEN` - Required if using `vercel-blob` (auto-added when you create Blob storage)
- `BACKUP_SECRET` - Optional but recommended for security

**Fix**:
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add missing variables
3. Redeploy your project

### 5. **Function Timeout**

**Symptom**: Backups start but timeout before completing

**Check**:
- Current timeout: 60 seconds (updated in `vercel.json`)
- Check Vercel function logs for timeout errors

**Fix**:
- If backups take longer than 60 seconds:
  - Upgrade to Pro plan (supports up to 300 seconds)
  - Or optimize backup to run faster

### 6. **Blob Storage Not Enabled**

**Symptom**: Backups fail with "BLOB_READ_WRITE_TOKEN not set"

**Fix**:
1. Go to Vercel Dashboard → Project → **Storage** tab
2. Click **Create Database** → Select **Blob**
3. Vercel will automatically add `BLOB_READ_WRITE_TOKEN`
4. Redeploy your API

## Verification Steps

### Step 1: Check Cron Job Status
```bash
# In Vercel Dashboard:
# Project → Settings → Cron Jobs
# Verify cron job exists and shows "Active" status
```

### Step 2: Test Health Endpoint
```bash
curl https://your-api.vercel.app/api/v1/backup/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-06T...",
  "service": "backup",
  "database": "connected"
}
```

### Step 3: Test Cron Detection
```bash
curl https://your-api.vercel.app/api/v1/backup/test-cron
```

This shows what headers Vercel sends and helps diagnose authentication issues.

### Step 4: Check Function Logs
1. Go to Vercel Dashboard → Project → Deployments
2. Click latest deployment → **Functions** tab
3. Find `/api/v1/backup/create`
4. Check logs for:
   - Authentication success/failure
   - Database connection issues
   - Storage errors
   - Timeout errors

### Step 5: Test Manual Backup
```bash
# If you have BACKUP_SECRET set:
export BACKUP_SECRET='your-secret'
curl -X POST https://your-api.vercel.app/api/v1/backup/create \
  -H "X-Backup-Secret: $BACKUP_SECRET"
```

## Recent Improvements

The following improvements were made to help diagnose and fix automatic backup issues:

1. **Enhanced Logging**: Added detailed logging with request IDs to track backup execution
2. **Better Cron Detection**: Improved detection of Vercel cron job requests (checks multiple header formats)
3. **Test Endpoint**: Added `/api/v1/backup/test-cron` to diagnose cron job configuration
4. **Increased Timeout**: Function timeout increased from 30 to 60 seconds
5. **Diagnostic Script**: Created `scripts/diagnose-backup.sh` for quick diagnosis

## Next Steps

1. **Run the diagnostic script**: `./scripts/diagnose-backup.sh`
2. **Check Vercel Dashboard**: Verify cron job is active
3. **Check logs**: Look for errors in Vercel function logs
4. **Test manually**: Try triggering a backup manually to verify the endpoint works
5. **Wait for next scheduled run**: Cron runs daily at 3:00 PM UTC (schedule: `0 15 * * *`)

## Schedule

Current backup schedule: **Daily at 3:00 PM UTC** (`0 15 * * *`)

To change the schedule, edit `apps/api/vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/v1/backup/create",
      "schedule": "0 15 * * *"  // Change this (cron format)
    }
  ]
}
```

Common schedules:
- `0 15 * * *` - Daily at 3:00 PM UTC
- `0 0 * * *` - Daily at midnight UTC
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight UTC

