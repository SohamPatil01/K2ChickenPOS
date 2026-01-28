# 🔍 Backup Failure Diagnosis Guide

## Common Failure Reasons & Solutions

### 1. **Authentication Failure** ❌

**Symptoms:**
- Error: "Unauthorized: Invalid backup secret or not a Vercel Cron job"
- Status: 401

**Causes:**
- Vercel Cron header not being detected
- BACKUP_SECRET mismatch (for manual backups)

**Solutions:**
1. **Check Vercel Cron Job Configuration:**
   - Go to Vercel Dashboard → Settings → Cron Jobs
   - Verify `/api/v1/backup/create` exists and is Active
   - Check the schedule is correct: `0 15 * * *` (8:30 PM IST)

2. **Check Function Logs:**
   - Go to Vercel Dashboard → Deployments → Latest → Functions
   - Look for logs starting with `[Backup] Auth check`
   - Check what headers are being received

3. **For Manual Testing:**
   ```bash
   curl -X POST https://your-api.vercel.app/api/v1/backup/create \
     -H "X-Backup-Secret: your-backup-secret"
   ```

**Fix Applied:** Enhanced Vercel Cron detection to check multiple header formats and user-agent.

---

### 2. **Storage Configuration Missing** ❌

**Symptoms:**
- Error: "BLOB_READ_WRITE_TOKEN environment variable is not set"
- Error: "Vercel Blob storage failed"
- Status: 500

**Causes:**
- Vercel Blob Storage not enabled
- BLOB_READ_WRITE_TOKEN not set in environment variables

**Solutions:**
1. **Enable Vercel Blob Storage:**
   - Go to Vercel Dashboard → Your Project → Storage
   - Click "Create Database" → Select "Blob"
   - Vercel will automatically add `BLOB_READ_WRITE_TOKEN`

2. **Verify Environment Variable:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Check that `BLOB_READ_WRITE_TOKEN` exists
   - Ensure it's set for Production environment

3. **Redeploy After Adding:**
   - After adding the token, trigger a new deployment
   - Or wait for the next automatic deployment

**Fix Applied:** Added explicit check and clearer error message for missing BLOB_READ_WRITE_TOKEN.

---

### 3. **Database Connection Failure** ❌

**Symptoms:**
- Error: "Database connection error"
- Error: "Prisma query failed"
- Status: 500

**Causes:**
- DATABASE_URL not set or incorrect
- Database not accessible from Vercel
- Database connection timeout

**Solutions:**
1. **Check DATABASE_URL:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Verify `DATABASE_URL` is set correctly
   - Ensure it's for Production environment

2. **Test Database Connection:**
   ```bash
   curl https://your-api.vercel.app/api/v1/backup/health
   ```
   Should return: `{"status":"ok","database":"connected"}`

3. **Check Database Access:**
   - Verify database allows connections from Vercel IPs
   - Check database firewall/security settings
   - Ensure database is running and accessible

---

### 4. **Function Timeout** ⏱️

**Symptoms:**
- Error: "Function execution timeout"
- Status: 504 or 500
- Backup partially completes

**Causes:**
- Backup takes too long (>10s on Hobby, >60s on Pro)
- Large database size
- Slow database queries

**Solutions:**
1. **Check Function Logs:**
   - Look for timeout errors in Vercel Function logs
   - Check backup size in logs: `[Backup] Data fetched successfully. Total size: X bytes`

2. **Optimize Backup:**
   - Reduce data being backed up
   - Use pagination for large tables
   - Consider incremental backups

3. **Upgrade Plan:**
   - Hobby: 10 seconds max
   - Pro: 60 seconds max
   - Enterprise: 900 seconds max

**Current Configuration:** Function timeout set to 30 seconds in `vercel.json`

---

### 5. **Missing Environment Variables** ❌

**Symptoms:**
- Various errors depending on missing variable
- Status: 500

**Required Variables:**
- `DATABASE_URL` - Database connection string (REQUIRED)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token (REQUIRED for storage)
- `BACKUP_SECRET` - Secret for manual backups (OPTIONAL, but recommended)
- `BACKUP_STORAGE_METHOD` - Storage method (OPTIONAL, defaults to 'vercel-blob')

**Solutions:**
1. **Check All Environment Variables:**
   ```bash
   # In Vercel Dashboard → Settings → Environment Variables
   # Verify these are set for Production:
   - DATABASE_URL
   - BLOB_READ_WRITE_TOKEN
   - BACKUP_SECRET (optional but recommended)
   ```

2. **Set Missing Variables:**
   - Add in Vercel Dashboard
   - Redeploy after adding

---

## 🔍 How to Diagnose the Issue

### Step 1: Check Function Logs
1. Go to Vercel Dashboard → Deployments → Latest deployment
2. Click "Functions" tab
3. Find `/api/v1/backup/create`
4. Check logs for:
   - `[Backup] Auth check` - Authentication status
   - `[Backup] Data fetched successfully` - Database query success
   - `[Backup] Storage method` - Which storage is being used
   - `[Backup] Failed` - Error details

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

### Step 3: Test Manual Backup
```bash
curl -X POST https://your-api.vercel.app/api/v1/backup/create \
  -H "X-Backup-Secret: your-backup-secret" \
  -v
```
Check the response and status code.

### Step 4: Verify Cron Job
1. Go to Vercel Dashboard → Settings → Cron Jobs
2. Verify:
   - Path: `/api/v1/backup/create`
   - Schedule: `0 15 * * *` (8:30 PM IST)
   - Status: Active
   - Last execution time

### Step 5: Check Environment Variables
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify all required variables are set for Production
3. Check variable values are correct (not empty)

---

## 📊 Log Analysis

### Successful Backup Logs:
```
[Backup] Auth check - VercelCron: true, Header: 1, UserAgent: ...
[Backup] Starting database backup at 2026-01-06T...
[Backup] Data fetched successfully. Total size: 1048576 bytes
[Backup] Storage method: vercel-blob
[Backup] Attempting to store in Vercel Blob...
[Backup] Successfully stored in Vercel Blob: https://...
[Backup] Database backup completed successfully. Size: 1048576 bytes
```

### Authentication Failure Logs:
```
[Backup] Auth check - VercelCron: false, Header: undefined, UserAgent: ...
[Backup] Authentication failed - VercelCron: false, HasSecret: true, ProvidedSecret: false
```

### Storage Failure Logs:
```
[Backup] Storage method: vercel-blob
[Backup] Attempting to store in Vercel Blob...
[Backup] Failed to store in Vercel Blob: BLOB_READ_WRITE_TOKEN is missing or invalid
```

---

## 🚀 Quick Fixes

### Fix 1: Enable Blob Storage
```bash
# In Vercel Dashboard:
1. Go to Storage tab
2. Create Blob database
3. Redeploy
```

### Fix 2: Set Environment Variables
```bash
# In Vercel Dashboard → Settings → Environment Variables:
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
BACKUP_SECRET=your-secret-here
```

### Fix 3: Verify Cron Job
```bash
# Check cron job is active in Vercel Dashboard
# If missing, ensure vercel.json has cron configuration
```

---

## 📞 Still Not Working?

1. **Check Vercel Status:** https://www.vercel-status.com/
2. **Review Function Logs:** Look for detailed error messages
3. **Test Manually:** Use curl to test the endpoint directly
4. **Check Database:** Verify database is accessible and running
5. **Contact Support:** If issue persists, contact Vercel support with logs

---

**Last Updated:** January 6, 2026  
**Status:** Enhanced error handling and logging ✅




