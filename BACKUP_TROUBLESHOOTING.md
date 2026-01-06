# 🔍 Auto Backup Troubleshooting Guide

## Why Auto Backup Didn't Happen

The automated backup system uses **Vercel Cron Jobs** to trigger backups daily at 11:55 AM UTC. If backups aren't running, check the following:

## ✅ Fixed Issues

### 1. **Authentication Issue (FIXED)**
**Problem**: Vercel Cron Jobs don't send custom headers, so the `BACKUP_SECRET` authentication was failing.

**Solution**: Updated the backup endpoint to accept Vercel Cron Jobs by checking for the `x-vercel-cron` header that Vercel automatically sends.

**Status**: ✅ Fixed in `apps/api/src/routes/backup.ts`

## 🔍 Common Issues to Check

### 1. **Vercel Plan Requirements**
**Issue**: Cron jobs require **Vercel Hobby plan or higher** (not available on free plan).

**Check**:
1. Go to Vercel Dashboard → Your Project → Settings → Plan
2. Verify you're on Hobby plan or higher

**Fix**: Upgrade to Hobby plan ($20/month) or Pro plan

### 2. **Cron Job Not Deployed**
**Issue**: The cron job configuration in `vercel.json` might not be deployed yet.

**Check**:
1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. Look for: `/api/v1/backup/create` with schedule `55 11 * * *`
3. If missing, the changes haven't been deployed

**Fix**:
```bash
# Commit and push changes
git add apps/api/vercel.json apps/api/src/routes/backup.ts
git commit -m "Fix auto backup authentication for Vercel Cron"
git push

# Or deploy manually
cd apps/api
vercel --prod
```

### 3. **Missing Environment Variables**
**Issue**: Required environment variables might not be set in Vercel.

**Check**:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify these are set:
   - `BACKUP_SECRET` (required for manual backups)
   - `DATABASE_URL` (required for database connection)
   - `BLOB_READ_WRITE_TOKEN` (required if using Vercel Blob storage)

**Fix**: Add missing environment variables in Vercel Dashboard

### 4. **Backup Storage Not Configured**
**Issue**: `BACKUP_STORAGE_METHOD` not set or Blob storage not enabled.

**Check**:
1. Go to Vercel Dashboard → Your Project → Storage
2. Verify Blob storage is created
3. Check environment variable `BACKUP_STORAGE_METHOD` (defaults to `vercel-blob`)

**Fix**:
1. Create Blob storage: Storage → Create Database → Blob
2. Vercel will automatically add `BLOB_READ_WRITE_TOKEN`
3. Redeploy your API

### 5. **Cron Job Path Mismatch**
**Issue**: The cron path might not match your actual API route.

**Check**:
- Cron path in `apps/api/vercel.json`: `/api/v1/backup/create`
- Actual route: Registered at `/api/v1/backup` with `/create` endpoint
- Should match: ✅

**Fix**: If path doesn't match, update `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/v1/backup/create",
      "schedule": "55 11 * * *"
    }
  ]
}
```

### 6. **Function Timeout**
**Issue**: Backup might be taking too long and timing out.

**Check**:
- Current timeout: 30 seconds (in `vercel.json`)
- Free plan limit: 10 seconds
- Pro plan limit: 60 seconds

**Fix**: If backups are timing out:
1. Upgrade to Pro plan for 60-second timeout
2. Or optimize backup to run faster (reduce data, parallel queries)

### 7. **Database Connection Issues**
**Issue**: Database might not be accessible from Vercel functions.

**Check**:
1. Test database connection:
```bash
curl https://your-api.vercel.app/api/v1/backup/health
```

**Fix**: Verify `DATABASE_URL` is correct and database allows connections from Vercel IPs

## 🔧 Verification Steps

### Step 1: Check Cron Job Status
1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. Verify cron job exists and is **Active**
3. Check last execution time

### Step 2: Check Function Logs
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click latest deployment → Functions tab
3. Find `/api/v1/backup/create`
4. Check logs for errors

### Step 3: Test Manual Backup
```bash
# Test backup endpoint manually
curl -X POST https://your-api.vercel.app/api/v1/backup/create \
  -H "X-Backup-Secret: your-backup-secret"
```

### Step 4: Check Environment Variables
```bash
# Verify environment variables are set (in Vercel Dashboard)
# Required:
# - BACKUP_SECRET
# - DATABASE_URL
# - BLOB_READ_WRITE_TOKEN (if using Vercel Blob)
```

## 📋 Checklist

- [ ] Vercel plan is Hobby or higher
- [ ] Cron job is configured in `apps/api/vercel.json`
- [ ] Cron job appears in Vercel Dashboard → Settings → Cron Jobs
- [ ] Cron job status is "Active"
- [ ] `BACKUP_SECRET` is set in Vercel environment variables
- [ ] `DATABASE_URL` is set in Vercel environment variables
- [ ] `BLOB_READ_WRITE_TOKEN` is set (if using Vercel Blob)
- [ ] Blob storage is created in Vercel Dashboard
- [ ] Latest code changes are deployed to Vercel
- [ ] Function logs show no errors
- [ ] Manual backup test succeeds

## 🚀 Quick Fix

If you just fixed the authentication issue:

1. **Deploy the fix**:
```bash
git add apps/api/src/routes/backup.ts
git commit -m "Fix auto backup authentication for Vercel Cron"
git push
```

2. **Wait for deployment** (usually 1-2 minutes)

3. **Verify cron job**:
   - Go to Vercel Dashboard → Settings → Cron Jobs
   - Check that cron job is active

4. **Wait for next scheduled run** (11:55 AM UTC) or **trigger manually**:
```bash
curl -X POST https://your-api.vercel.app/api/v1/backup/create \
  -H "X-Backup-Secret: your-backup-secret"
```

## 📞 Still Not Working?

1. Check Vercel Function Logs for specific error messages
2. Verify all environment variables are set correctly
3. Test the backup endpoint manually to isolate the issue
4. Check Vercel status page for any service outages
5. Review the backup endpoint code for any other issues

## 🔗 Related Files

- `apps/api/src/routes/backup.ts` - Backup endpoint implementation
- `apps/api/vercel.json` - Cron job configuration
- `BACKUP_ARCHITECTURE.md` - System architecture
- `DATABASE_BACKUP_GUIDE.md` - Setup guide

---

**Last Updated**: January 6, 2026  
**Status**: Authentication fix applied ✅

