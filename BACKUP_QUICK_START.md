# Database Backup - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Add Environment Variables to Vercel

```bash
# Go to: https://vercel.com/dashboard
# Select: k2-chicken-pos-api project
# Navigate: Settings → Environment Variables
# Add these:

BACKUP_SECRET=your-super-secret-backup-key-min-32-chars
BACKUP_STORAGE_METHOD=vercel-blob
```

### Step 2: Enable Vercel Blob Storage

```bash
# In Vercel Dashboard:
# 1. Go to Storage tab
# 2. Click "Create Database" → Select "Blob"
# 3. Vercel automatically adds BLOB_READ_WRITE_TOKEN
```

### Step 3: Deploy

```bash
git add .
git commit -m "Add automated database backup"
git push
```

That's it! ✅ Backups will run daily at 2:00 AM UTC.

---

## 🧪 Test Your Backup

### Test 1: Manual Backup

```bash
curl -X POST https://k2-chicken-pos-api.vercel.app/api/v1/backup/create \
  -H "X-Backup-Secret: your-backup-secret"
```

### Test 2: List Backups

```bash
curl https://k2-chicken-pos-api.vercel.app/api/v1/backup/list \
  -H "X-Backup-Secret: your-backup-secret"
```

---

## 📋 What Gets Backed Up?

- ✅ Stores
- ✅ Users (passwords excluded)
- ✅ Products
- ✅ Customers
- ✅ Sales & Payments
- ✅ Inventory Ledger
- ✅ Purchase Orders
- ✅ Deliveries
- ✅ Franchises
- ✅ Royalty Settings
- ✅ Compliance Checks
- ✅ Discount Approvals

---

## ⏰ Backup Schedule

**Default**: Daily at 2:00 AM UTC

**Change schedule** in `apps/api/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/v1/backup/create",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Common schedules**:
- Every 6 hours: `0 */6 * * *`
- Twice daily: `0 2,14 * * *`
- Weekly: `0 2 * * 0`

---

## 🔍 Monitor Backups

1. Go to Vercel Dashboard
2. Select your API project
3. Click **Deployments** → Latest deployment
4. Go to **Functions** tab
5. Look for logs from `/api/v1/backup/create`

---

## 💰 Cost

**Vercel Blob Storage**:
- Free tier: 500 MB storage
- Typical backup: 1-10 MB
- Monthly storage: ~30-300 MB
- **Estimated cost**: < $1/month on Hobby plan

**Vercel Cron Jobs**:
- Requires Hobby plan or higher ($20/month)
- Includes 1 cron job

---

## 🆘 Troubleshooting

### Backup not running?
1. Check Settings → Cron Jobs in Vercel
2. Ensure you're on Hobby plan or higher
3. Redeploy the project

### "Unauthorized" error?
1. Verify `BACKUP_SECRET` is set in Vercel
2. Check the secret matches
3. Redeploy after adding variables

### Blob storage error?
1. Create Blob storage in Vercel Dashboard
2. Check `BLOB_READ_WRITE_TOKEN` is set
3. Redeploy

---

## 📖 Full Documentation

See `DATABASE_BACKUP_GUIDE.md` for complete documentation including:
- Detailed setup instructions
- Restore procedures
- Advanced configuration
- Security best practices
- AWS S3 alternative

---

## 🎯 Summary

✅ Automated daily backups  
✅ Secure cloud storage  
✅ Easy restoration  
✅ Cost-effective  
✅ Production-ready  

Your database is protected! 🎉

