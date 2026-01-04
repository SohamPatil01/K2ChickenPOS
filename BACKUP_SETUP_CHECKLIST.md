# Database Backup Setup Checklist

Use this checklist to ensure your automated backup system is properly configured.

## ☑️ Pre-Deployment Checklist

### 1. Code Changes
- [x] Backup route created (`apps/api/src/routes/backup.ts`)
- [x] Backup route registered in main API (`apps/api/src/index.ts`)
- [x] Cron job configured in `apps/api/vercel.json`
- [x] Dependencies added to `apps/api/package.json`
  - [x] `@vercel/blob` package added

### 2. Environment Variables Prepared
- [ ] `BACKUP_SECRET` generated (min 32 characters)
- [ ] `BACKUP_STORAGE_METHOD` decided (vercel-blob or s3)
- [ ] If using Vercel Blob: Ready to enable in Vercel Dashboard
- [ ] If using AWS S3: AWS credentials ready
  - [ ] `AWS_REGION`
  - [ ] `AWS_ACCESS_KEY_ID`
  - [ ] `AWS_SECRET_ACCESS_KEY`
  - [ ] `AWS_S3_BACKUP_BUCKET`

## ☑️ Vercel Configuration Checklist

### 3. Vercel Project Settings
- [ ] Logged into [Vercel Dashboard](https://vercel.com/dashboard)
- [ ] Selected correct project: `k2-chicken-pos-api`
- [ ] Verified project is on Hobby plan or higher (required for cron jobs)

### 4. Environment Variables Added
- [ ] Navigate to: Settings → Environment Variables
- [ ] Added `BACKUP_SECRET`
  - [ ] Applied to: Production ✓
  - [ ] Applied to: Preview ✓
  - [ ] Applied to: Development ✓
- [ ] Added `BACKUP_STORAGE_METHOD` (value: `vercel-blob`)
  - [ ] Applied to: Production ✓
  - [ ] Applied to: Preview ✓
  - [ ] Applied to: Development ✓

### 5. Vercel Blob Storage Setup
- [ ] Navigate to: Storage tab
- [ ] Clicked "Create Database"
- [ ] Selected "Blob"
- [ ] Named the storage (e.g., "database-backups")
- [ ] Verified `BLOB_READ_WRITE_TOKEN` was auto-added
- [ ] Checked token is applied to all environments

## ☑️ Deployment Checklist

### 6. Deploy Code Changes
- [ ] Committed all changes to git
  ```bash
  git add .
  git commit -m "Add automated database backup system"
  ```
- [ ] Pushed to GitHub
  ```bash
  git push origin main
  ```
- [ ] Verified Vercel auto-deployment started
- [ ] Waited for deployment to complete (check Vercel Dashboard)
- [ ] Deployment status: Ready ✓

### 7. Verify Cron Job Configuration
- [ ] Navigate to: Settings → Cron Jobs
- [ ] Verified cron job appears:
  - [ ] Path: `/api/v1/backup/create`
  - [ ] Schedule: `0 2 * * *`
  - [ ] Status: Active
- [ ] If not visible: Redeployed project

## ☑️ Testing Checklist

### 8. Test Backup Endpoints
- [ ] Tested health endpoint:
  ```bash
  curl https://k2-chicken-pos-api.vercel.app/api/v1/backup/health
  ```
  - [ ] Response status: "ok"
  - [ ] Database: "connected"

- [ ] Tested manual backup:
  ```bash
  curl -X POST https://k2-chicken-pos-api.vercel.app/api/v1/backup/create \
    -H "X-Backup-Secret: YOUR_SECRET"
  ```
  - [ ] Response success: true
  - [ ] Backup size reported
  - [ ] Table counts shown

- [ ] Tested list backups:
  ```bash
  curl https://k2-chicken-pos-api.vercel.app/api/v1/backup/list \
    -H "X-Backup-Secret: YOUR_SECRET"
  ```
  - [ ] Response success: true
  - [ ] At least 1 backup listed
  - [ ] Backup URL accessible

### 9. Run Test Script
- [ ] Set environment variables:
  ```bash
  export BACKUP_SECRET='your-backup-secret'
  export API_URL='https://k2-chicken-pos-api.vercel.app'
  ```
- [ ] Ran test script:
  ```bash
  ./scripts/test-backup.sh
  ```
- [ ] All tests passed ✓

### 10. Verify Backup Storage
- [ ] Navigate to Vercel Dashboard → Storage → Blob
- [ ] Verified backup file exists
- [ ] Checked backup file size (should be > 0 bytes)
- [ ] Downloaded backup file (optional)
- [ ] Verified JSON format is valid (optional)

## ☑️ Monitoring Checklist

### 11. Check Function Logs
- [ ] Navigate to: Deployments → Latest deployment
- [ ] Clicked: Functions tab
- [ ] Found: `/api/v1/backup/create` function
- [ ] Clicked: View Logs
- [ ] Verified: "Database backup completed successfully" message

### 12. Set Up Monitoring (Optional)
- [ ] Documented backup schedule (2:00 AM UTC daily)
- [ ] Set calendar reminder to check backups weekly
- [ ] Configured alerts (if using external monitoring)
- [ ] Set up log drains (if on Pro plan)

## ☑️ Documentation Checklist

### 13. Team Documentation
- [ ] Shared `DATABASE_BACKUP_GUIDE.md` with team
- [ ] Shared `BACKUP_QUICK_START.md` with team
- [ ] Documented `BACKUP_SECRET` location (password manager)
- [ ] Added backup procedures to runbook

### 14. Security Documentation
- [ ] Stored `BACKUP_SECRET` in password manager
- [ ] Documented who has access to backup secret
- [ ] Documented backup retention policy
- [ ] Scheduled backup secret rotation (recommended: every 90 days)

## ☑️ Maintenance Checklist

### 15. Regular Maintenance
- [ ] Schedule: Weekly backup verification
- [ ] Schedule: Monthly restore test
- [ ] Schedule: Quarterly backup secret rotation
- [ ] Schedule: Annual backup retention review

### 16. First Week Monitoring
- [ ] Day 1: Verify first automated backup ran
- [ ] Day 2: Check backup file size is reasonable
- [ ] Day 3: Download and inspect backup JSON
- [ ] Day 7: Verify 7 backup files exist

## ☑️ Disaster Recovery Checklist

### 17. Restore Procedure Documentation
- [ ] Documented restore procedure
- [ ] Created restore script (optional)
- [ ] Tested restore on staging environment
- [ ] Documented RTO (Recovery Time Objective)
- [ ] Documented RPO (Recovery Point Objective)

### 18. Backup Validation
- [ ] Verified all critical tables are backed up
- [ ] Checked backup includes:
  - [ ] Stores
  - [ ] Users
  - [ ] Products
  - [ ] Customers
  - [ ] Sales & Payments
  - [ ] Inventory
  - [ ] Purchase Orders
  - [ ] Deliveries
  - [ ] Franchises
  - [ ] Compliance data

## 🎯 Final Verification

### All Systems Go!
- [ ] ✅ Backup endpoint is accessible
- [ ] ✅ Manual backup works
- [ ] ✅ Cron job is configured
- [ ] ✅ Backup storage is working
- [ ] ✅ Logs show successful backups
- [ ] ✅ Team is informed
- [ ] ✅ Documentation is complete

## 📊 Success Criteria

Your backup system is fully operational when:

1. ✅ Cron job runs daily at 2:00 AM UTC
2. ✅ Backups are stored in Vercel Blob
3. ✅ Backup files are valid JSON
4. ✅ All critical tables are included
5. ✅ Logs show no errors
6. ✅ Team knows how to restore

## 🆘 If Something Goes Wrong

### Backup Not Running
1. Check Vercel plan (Hobby or higher required)
2. Verify cron job in Settings → Cron Jobs
3. Check environment variables are set
4. Redeploy the project

### Backup Fails
1. Check Function Logs for errors
2. Verify database connection
3. Check `DATABASE_URL` is correct
4. Verify `BACKUP_SECRET` is set
5. Check Blob storage is enabled

### Can't Access Backups
1. Verify `BACKUP_SECRET` is correct
2. Check Blob storage permissions
3. Verify `BLOB_READ_WRITE_TOKEN` is set
4. Try manual backup first

## 📞 Support Resources

- **Full Guide**: `DATABASE_BACKUP_GUIDE.md`
- **Quick Start**: `BACKUP_QUICK_START.md`
- **Test Script**: `scripts/test-backup.sh`
- **Vercel Docs**: https://vercel.com/docs/cron-jobs
- **Vercel Blob Docs**: https://vercel.com/docs/storage/vercel-blob

---

**Last Updated**: January 4, 2026  
**Version**: 1.0  
**Status**: Ready for Production ✅

