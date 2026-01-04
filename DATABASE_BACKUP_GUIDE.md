# Database Backup System - Vercel Cloud

This guide explains how to set up and use the automated database backup system for your K2ChickenPOS cloud database on Vercel.

## Overview

The backup system provides:
- **Automated daily backups** via Vercel Cron Jobs
- **Manual backup triggers** via API endpoint
- **Secure storage** using Vercel Blob Storage or AWS S3
- **JSON-based backups** of all critical database tables
- **Easy restoration** process

## Architecture

```
┌─────────────────┐
│  Vercel Cron    │ ──── Triggers at 2:00 AM UTC daily
│  (Scheduler)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backup API     │ ──── POST /api/v1/backup/create
│  Endpoint       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │ ──── Fetches all data via Prisma
│  Database       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vercel Blob    │ ──── Stores JSON backup files
│  Storage        │
└─────────────────┘
```

## Setup Instructions

### Step 1: Configure Environment Variables

Add these environment variables to your Vercel API project:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **k2-chicken-pos-api** project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

#### Required Variables

```bash
# Backup Security Secret (generate a strong random string)
BACKUP_SECRET=your-super-secret-backup-key-min-32-chars

# Storage Method (choose one: 'vercel-blob' or 's3')
BACKUP_STORAGE_METHOD=vercel-blob
```

#### For Vercel Blob Storage (Recommended)

```bash
# Vercel Blob Token (automatically provided by Vercel when you enable Blob Storage)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

**To get Blob Storage:**
1. In your Vercel project, go to **Storage** tab
2. Click **Create Database** → Select **Blob**
3. Vercel will automatically add the `BLOB_READ_WRITE_TOKEN` environment variable
4. Redeploy your API

#### For AWS S3 Storage (Alternative)

```bash
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_S3_BACKUP_BUCKET=your-backup-bucket-name
```

### Step 2: Install Dependencies

The required dependencies are already added to `apps/api/package.json`:

```json
{
  "dependencies": {
    "@vercel/blob": "^0.23.0"
  }
}
```

If using AWS S3, add:

```bash
cd apps/api
pnpm add @aws-sdk/client-s3
```

### Step 3: Deploy to Vercel

The cron job is already configured in `apps/api/vercel.json`:

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

This runs the backup **every day at 2:00 AM UTC**.

**Deploy:**

```bash
# Push changes to GitHub
git add .
git commit -m "Add automated database backup system"
git push

# Vercel will automatically deploy
```

Or deploy manually:

```bash
cd apps/api
vercel --prod
```

### Step 4: Verify Cron Job

1. Go to your Vercel project dashboard
2. Click **Settings** → **Cron Jobs**
3. You should see:
   - **Path**: `/api/v1/backup/create`
   - **Schedule**: `0 2 * * *` (Daily at 2:00 AM UTC)
   - **Status**: Active

## API Endpoints

### 1. Health Check

```bash
GET /api/v1/backup/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-04T12:00:00.000Z",
  "service": "backup",
  "database": "connected"
}
```

### 2. Create Backup (Manual Trigger)

```bash
POST /api/v1/backup/create
Headers:
  X-Backup-Secret: your-backup-secret
```

**Or with query parameter:**

```bash
POST /api/v1/backup/create?secret=your-backup-secret
```

**Response:**
```json
{
  "success": true,
  "message": "Database backup created successfully",
  "timestamp": "2026-01-04T12:00:00.000Z",
  "backupSize": 1048576,
  "tables": {
    "stores": 5,
    "users": 12,
    "products": 150,
    "sales": 1234,
    "customers": 567,
    "inventoryLedger": 890,
    "payments": 1234
  }
}
```

### 3. List Backups

```bash
GET /api/v1/backup/list
Headers:
  X-Backup-Secret: your-backup-secret
```

**Response:**
```json
{
  "success": true,
  "storageMethod": "vercel-blob",
  "backups": [
    {
      "filename": "backup-2026-01-04T02-00-00.000Z.json",
      "url": "https://blob.vercel-storage.com/...",
      "size": 1048576,
      "uploadedAt": "2026-01-04T02:00:00.000Z"
    }
  ]
}
```

## Backup Contents

Each backup includes:

### Metadata
- Version number
- Timestamp
- Source (vercel-cron-backup)
- Database host (without credentials)

### Data Tables
- **Stores**: All store information
- **Users**: User accounts (passwords excluded for security)
- **Products**: Product catalog
- **Customers**: Customer database
- **Sales**: Sales transactions
- **Sale Items**: Line items for each sale
- **Payments**: Payment records
- **Inventory Ledger**: Inventory movements
- **Purchase Orders**: PO records
- **Purchase Order Items**: PO line items
- **Deliveries**: Delivery records
- **Delivery Items**: Delivery line items
- **Franchises**: Franchise information
- **Royalty Settings**: Royalty configurations
- **Compliance Checks**: Compliance audit logs
- **Discount Approvals**: Discount approval records

## Testing the Backup System

### Test 1: Manual Backup

```bash
# Replace with your actual API URL and backup secret
curl -X POST https://k2-chicken-pos-api.vercel.app/api/v1/backup/create \
  -H "X-Backup-Secret: your-backup-secret"
```

### Test 2: Check Backup Health

```bash
curl https://k2-chicken-pos-api.vercel.app/api/v1/backup/health
```

### Test 3: List Backups

```bash
curl https://k2-chicken-pos-api.vercel.app/api/v1/backup/list \
  -H "X-Backup-Secret: your-backup-secret"
```

### Test 4: Verify Cron Job

1. Wait for the scheduled time (2:00 AM UTC)
2. Check Vercel Function Logs:
   - Go to **Deployments** → Click latest deployment
   - Go to **Functions** tab
   - Look for logs from `/api/v1/backup/create`

## Backup Schedule

The default schedule is **daily at 2:00 AM UTC**.

### Modify Backup Schedule

Edit `apps/api/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/v1/backup/create",
      "schedule": "0 2 * * *"  // Cron expression
    }
  ]
}
```

**Common Schedules:**

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Every hour | `0 * * * *` | Runs at minute 0 of every hour |
| Every 6 hours | `0 */6 * * *` | Runs at 00:00, 06:00, 12:00, 18:00 UTC |
| Daily at 2 AM | `0 2 * * *` | Runs at 2:00 AM UTC every day |
| Twice daily | `0 2,14 * * *` | Runs at 2:00 AM and 2:00 PM UTC |
| Weekly (Sunday) | `0 2 * * 0` | Runs at 2:00 AM UTC every Sunday |

**Note**: Vercel cron jobs use UTC timezone.

## Restoring from Backup

### Step 1: Download Backup File

```bash
# Get the backup URL from the list endpoint
curl https://k2-chicken-pos-api.vercel.app/api/v1/backup/list \
  -H "X-Backup-Secret: your-backup-secret"

# Download the backup file
curl -o backup.json "https://blob.vercel-storage.com/backup-2026-01-04T02-00-00.000Z.json"
```

### Step 2: Restore Data

Create a restore script or use Prisma Studio:

```typescript
// restore-backup.ts
import { readFile } from 'fs/promises';
import { prisma } from '@azela-pos/db';

async function restoreBackup(backupFile: string) {
  const backup = JSON.parse(await readFile(backupFile, 'utf-8'));
  
  console.log('Restoring backup from:', backup.metadata.timestamp);
  
  // Restore in order (respecting foreign key constraints)
  await prisma.store.createMany({ data: backup.data.stores, skipDuplicates: true });
  await prisma.user.createMany({ data: backup.data.users, skipDuplicates: true });
  await prisma.product.createMany({ data: backup.data.products, skipDuplicates: true });
  await prisma.customer.createMany({ data: backup.data.customers, skipDuplicates: true });
  await prisma.sale.createMany({ data: backup.data.sales, skipDuplicates: true });
  await prisma.saleItem.createMany({ data: backup.data.saleItems, skipDuplicates: true });
  await prisma.payment.createMany({ data: backup.data.payments, skipDuplicates: true });
  await prisma.inventoryLedger.createMany({ data: backup.data.inventoryLedger, skipDuplicates: true });
  
  console.log('Restore completed successfully!');
}

// Usage: tsx restore-backup.ts backup.json
restoreBackup(process.argv[2]);
```

## Monitoring and Alerts

### Check Backup Logs

1. Go to Vercel Dashboard → Your API Project
2. Click **Deployments** → Select latest deployment
3. Go to **Functions** tab
4. Click on the function → **View Logs**
5. Filter by `/api/v1/backup/create`

### Set Up Alerts (Optional)

You can set up monitoring using:

1. **Vercel Log Drains** (Pro plan)
   - Send logs to external services like Datadog, Logtail, etc.

2. **Custom Monitoring Script**
   - Create a separate service that calls `/api/v1/backup/list` daily
   - Alert if no new backup in 24 hours

3. **GitHub Actions**
   - Create a workflow that checks backup status daily
   - Send notifications via email/Slack if backup fails

## Security Best Practices

1. **Keep BACKUP_SECRET secure**
   - Use a strong, random string (min 32 characters)
   - Never commit it to version control
   - Rotate it periodically

2. **Limit backup access**
   - Only authorized services should have the backup secret
   - Use Vercel's environment variable encryption

3. **Secure backup storage**
   - Use Vercel Blob with restricted access
   - For S3, use IAM roles with minimal permissions
   - Enable versioning on S3 buckets

4. **Monitor backup logs**
   - Regularly check for failed backups
   - Set up alerts for backup failures

5. **Test restore process**
   - Periodically test restoring from backups
   - Verify data integrity after restore

## Troubleshooting

### Issue 1: Cron job not triggering

**Solution:**
1. Check Vercel Dashboard → Settings → Cron Jobs
2. Ensure cron is enabled (requires Hobby plan or higher)
3. Verify `vercel.json` syntax is correct
4. Redeploy the project

### Issue 2: "Unauthorized: Invalid backup secret"

**Solution:**
1. Verify `BACKUP_SECRET` is set in Vercel environment variables
2. Check the secret value matches what you're sending
3. Ensure environment variable is applied to Production environment
4. Redeploy after adding environment variables

### Issue 3: "Vercel Blob storage failed"

**Solution:**
1. Go to Vercel Dashboard → Storage tab
2. Create a Blob storage if not exists
3. Verify `BLOB_READ_WRITE_TOKEN` is set automatically
4. Redeploy the project

### Issue 4: Backup file is empty or incomplete

**Solution:**
1. Check database connection in backup logs
2. Verify `DATABASE_URL` is correct
3. Check for database query timeouts
4. Consider increasing function timeout in `vercel.json`

### Issue 5: Function timeout during backup

**Solution:**
1. Increase timeout in `vercel.json`:
   ```json
   {
     "functions": {
       "api/index.ts": {
         "maxDuration": 60
       }
     }
   }
   ```
2. Note: Free tier has 10s limit, Pro has 60s limit
3. Consider optimizing queries or backing up in chunks

## Cost Considerations

### Vercel Blob Storage
- **Free tier**: 500 MB storage, 5 GB bandwidth/month
- **Pro tier**: 1 TB storage, 1 TB bandwidth/month
- **Pricing**: $0.15/GB storage, $0.30/GB bandwidth

### Vercel Cron Jobs
- **Free**: Not available on Free tier
- **Hobby**: 1 cron job included
- **Pro**: Unlimited cron jobs

### Estimated Costs

For a typical POS database:
- **Backup size**: ~1-10 MB per backup
- **Daily backups**: ~30-300 MB/month storage
- **Monthly cost**: < $1 on Hobby plan

**Recommendation**: Start with Vercel Blob on Hobby plan. Upgrade to Pro if you need more frequent backups or larger storage.

## Advanced Configuration

### Backup Retention Policy

To implement automatic cleanup of old backups, you can:

1. Create a cleanup endpoint in `backup.ts`
2. Add a cron job to run weekly
3. Delete backups older than 30 days

Example:

```typescript
fastify.post('/cleanup', async (request, reply) => {
  // Delete backups older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Implementation depends on storage method
  // For Vercel Blob: use del() API
  // For S3: use DeleteObjectCommand
});
```

### Incremental Backups

For large databases, consider implementing incremental backups:

1. Store last backup timestamp
2. Only backup records modified since last backup
3. Combine with full weekly backups

### Compression

To reduce storage costs, compress backups:

```typescript
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

const compressed = await gzipAsync(Buffer.from(backupJson));
await put(filename, compressed, { contentType: 'application/gzip' });
```

## Support

If you encounter issues:

1. Check Vercel Function Logs
2. Verify all environment variables are set
3. Test the backup endpoint manually
4. Check Vercel status page for outages
5. Review this guide's troubleshooting section

## Summary

✅ **Automated daily backups** at 2:00 AM UTC  
✅ **Secure storage** with Vercel Blob or AWS S3  
✅ **Manual backup triggers** via API  
✅ **Easy restoration** from JSON files  
✅ **Monitoring** via Vercel logs  
✅ **Cost-effective** on Hobby plan  

Your database is now protected with automated backups! 🎉

