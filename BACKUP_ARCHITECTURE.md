# Database Backup System - Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VERCEL CLOUD PLATFORM                        │
│                                                                       │
│  ┌────────────────────┐                                             │
│  │   Vercel Cron      │  Triggers daily at 11:55 AM UTC              │
│  │   Scheduler        │  Schedule: "55 11 * * *"                     │
│  └─────────┬──────────┘                                             │
│            │                                                          │
│            │ HTTP POST                                                │
│            ▼                                                          │
│  ┌────────────────────┐                                             │
│  │  Backup API        │  POST /api/v1/backup/create                 │
│  │  Endpoint          │  Authentication: X-Backup-Secret            │
│  │  (Fastify)         │                                             │
│  └─────────┬──────────┘                                             │
│            │                                                          │
│            │ Prisma Query                                             │
│            ▼                                                          │
│  ┌────────────────────┐                                             │
│  │  PostgreSQL        │  Fetches all critical tables:               │
│  │  Database          │  - Stores, Users, Products                  │
│  │  (Vercel Postgres) │  - Sales, Customers, Inventory              │
│  │                    │  - POs, Deliveries, Franchises              │
│  └─────────┬──────────┘                                             │
│            │                                                          │
│            │ JSON Data                                                │
│            ▼                                                          │
│  ┌────────────────────┐                                             │
│  │  Backup Processor  │  - Formats data as JSON                     │
│  │                    │  - Adds metadata (timestamp, version)       │
│  │                    │  - Excludes sensitive data (passwords)      │
│  └─────────┬──────────┘                                             │
│            │                                                          │
│            │ Store Backup                                             │
│            ▼                                                          │
│  ┌────────────────────┐                                             │
│  │  Vercel Blob       │  Stores JSON backup files:                  │
│  │  Storage           │  backup-2026-01-04T11-55-00.000Z.json      │
│  │                    │  - Secure cloud storage                     │
│  │                    │  - Public/private access control            │
│  └────────────────────┘                                             │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

                              │
                              │ HTTPS
                              ▼

┌─────────────────────────────────────────────────────────────────────┐
│                         MANUAL OPERATIONS                            │
│                                                                       │
│  ┌────────────────────┐     ┌────────────────────┐                 │
│  │  Manual Backup     │     │  List Backups      │                 │
│  │  Trigger           │     │                    │                 │
│  │  (curl/API call)   │     │  GET /list         │                 │
│  └────────────────────┘     └────────────────────┘                 │
│                                                                       │
│  ┌────────────────────┐     ┌────────────────────┐                 │
│  │  Download Backup   │     │  Restore Database  │                 │
│  │  (from Blob URL)   │     │  (Prisma script)   │                 │
│  └────────────────────┘     └────────────────────┘                 │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## 🔄 Backup Flow Diagram

```
START
  │
  ├─ [Automated] Vercel Cron triggers at 11:55 AM UTC
  │     OR
  └─ [Manual] User calls POST /api/v1/backup/create
  │
  ▼
┌─────────────────────────┐
│ Authenticate Request    │
│ (Check BACKUP_SECRET)   │
└────────┬────────────────┘
         │
         ├─ ✅ Valid → Continue
         └─ ❌ Invalid → Return 401 Unauthorized
         │
         ▼
┌─────────────────────────┐
│ Connect to Database     │
│ (via Prisma Client)     │
└────────┬────────────────┘
         │
         ├─ ✅ Connected → Continue
         └─ ❌ Failed → Return 500 Error
         │
         ▼
┌─────────────────────────┐
│ Fetch All Data          │
│ (Parallel Queries)      │
│                         │
│ - Stores                │
│ - Users (no passwords)  │
│ - Products              │
│ - Customers             │
│ - Sales & Items         │
│ - Payments              │
│ - Inventory             │
│ - Purchase Orders       │
│ - Deliveries            │
│ - Franchises            │
│ - Royalty Settings      │
│ - Compliance Checks     │
│ - Discount Approvals    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Create Backup Object    │
│                         │
│ {                       │
│   metadata: {...},      │
│   data: {...}           │
│ }                       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Convert to JSON         │
│ (Pretty print)          │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Store in Vercel Blob    │
│                         │
│ Filename:               │
│ backup-[timestamp].json │
└────────┬────────────────┘
         │
         ├─ ✅ Success → Return success response
         └─ ❌ Failed → Return 500 Error
         │
         ▼
┌─────────────────────────┐
│ Return Response         │
│                         │
│ {                       │
│   success: true,        │
│   timestamp: "...",     │
│   backupSize: 1048576,  │
│   tables: {...}         │
│ }                       │
└─────────────────────────┘
  │
  ▼
END
```

## 📊 Data Flow

```
┌──────────────┐
│  PostgreSQL  │
│  Database    │
└──────┬───────┘
       │
       │ Prisma Query (SELECT *)
       │
       ▼
┌──────────────┐
│  Prisma      │
│  Client      │
└──────┬───────┘
       │
       │ JavaScript Objects
       │
       ▼
┌──────────────┐
│  Backup      │
│  Processor   │
└──────┬───────┘
       │
       │ JSON String
       │
       ▼
┌──────────────┐
│  Vercel      │
│  Blob API    │
└──────┬───────┘
       │
       │ Blob URL
       │
       ▼
┌──────────────┐
│  Cloud       │
│  Storage     │
└──────────────┘
```

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
│                                                               │
│  Layer 1: HTTPS Encryption                                   │
│  ├─ All API calls use TLS 1.3                               │
│  └─ Vercel provides automatic HTTPS                          │
│                                                               │
│  Layer 2: Authentication                                     │
│  ├─ BACKUP_SECRET required for all operations               │
│  ├─ Secret stored in Vercel environment variables           │
│  └─ Encrypted at rest by Vercel                             │
│                                                               │
│  Layer 3: Data Sanitization                                 │
│  ├─ User passwords excluded from backups                    │
│  ├─ Only database host included (no credentials)            │
│  └─ Sensitive fields filtered                               │
│                                                               │
│  Layer 4: Storage Security                                  │
│  ├─ Vercel Blob with access controls                        │
│  ├─ Private by default (public optional)                    │
│  └─ BLOB_READ_WRITE_TOKEN required                          │
│                                                               │
│  Layer 5: Network Security                                  │
│  ├─ Vercel's DDoS protection                                │
│  ├─ Rate limiting on API endpoints                          │
│  └─ Firewall rules                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🕐 Cron Job Schedule

```
UTC Time:  00:00  02:00  04:00  06:00  08:00  10:00  12:00  14:00  16:00  18:00  20:00  22:00
           ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────
Backup:           🔄
           ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────  ─────

Legend:
🔄 = Automated backup runs (11:55 AM UTC daily)

Cron Expression: "55 11 * * *"
├─ 55: Minute (55 = at 55 minutes past the hour)
├─ 11: Hour (11 = 11:55 AM UTC)
├─ *: Day of month (every day)
├─ *: Month (every month)
└─ *: Day of week (every day of week)
```

## 💾 Storage Architecture

```
Vercel Blob Storage
├─ backup-2026-01-04T02-00-00.000Z.json  (1.2 MB)
├─ backup-2026-01-05T02-00-00.000Z.json  (1.3 MB)
├─ backup-2026-01-06T02-00-00.000Z.json  (1.2 MB)
├─ backup-2026-01-07T02-00-00.000Z.json  (1.4 MB)
├─ backup-2026-01-08T02-00-00.000Z.json  (1.3 MB)
├─ backup-2026-01-09T02-00-00.000Z.json  (1.5 MB)
└─ backup-2026-01-10T02-00-00.000Z.json  (1.4 MB)

Total Storage: ~9 MB (7 days)
Monthly Storage: ~40 MB (30 days)
Cost: < $0.01/month
```

## 🔄 Restore Architecture

```
┌──────────────┐
│  Download    │  curl -o backup.json [blob-url]
│  Backup      │
└──────┬───────┘
       │
       │ backup.json
       │
       ▼
┌──────────────┐
│  Parse JSON  │  JSON.parse(backupFile)
└──────┬───────┘
       │
       │ JavaScript Object
       │
       ▼
┌──────────────┐
│  Validate    │  Check metadata, version
│  Backup      │
└──────┬───────┘
       │
       │ Validated Data
       │
       ▼
┌──────────────┐
│  Restore     │  prisma.table.createMany()
│  to Database │  (in order, respecting FK constraints)
└──────┬───────┘
       │
       │ Success
       │
       ▼
┌──────────────┐
│  Verify      │  Check record counts
│  Restore     │
└──────────────┘
```

## 📈 Scalability

```
Database Size    Backup Size    Backup Time    Storage Cost/Month
─────────────    ───────────    ───────────    ──────────────────
10 MB            1 MB           5 seconds      $0.01
100 MB           10 MB          15 seconds     $0.05
1 GB             100 MB         60 seconds     $0.50
10 GB            1 GB           300 seconds    $5.00

Note: Times are estimates. Actual performance depends on:
- Database load
- Network latency
- Number of records
- Vercel function limits (10s free, 60s pro)
```

## 🔧 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    K2ChickenPOS API                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Fastify Server (apps/api/src/index.ts)            │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Backup Routes                               │   │   │
│  │  │  (apps/api/src/routes/backup.ts)            │   │   │
│  │  │                                               │   │   │
│  │  │  ┌─────────────────────────────────────┐   │   │   │
│  │  │  │  GET /health                         │   │   │   │
│  │  │  │  - Check service status              │   │   │   │
│  │  │  └─────────────────────────────────────┘   │   │   │
│  │  │                                               │   │   │
│  │  │  ┌─────────────────────────────────────┐   │   │   │
│  │  │  │  POST /create                        │   │   │   │
│  │  │  │  - Authenticate                      │   │   │   │
│  │  │  │  - Fetch all data                    │   │   │   │
│  │  │  │  - Create JSON backup                │   │   │   │
│  │  │  │  - Store in Blob                     │   │   │   │
│  │  │  └─────────────────────────────────────┘   │   │   │
│  │  │                                               │   │   │
│  │  │  ┌─────────────────────────────────────┐   │   │   │
│  │  │  │  GET /list                           │   │   │   │
│  │  │  │  - Authenticate                      │   │   │   │
│  │  │  │  - List all backups                  │   │   │   │
│  │  │  └─────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────┘   │   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Prisma Client (@azela-pos/db)                      │   │
│  │  - Database queries                                  │   │
│  │  - Type-safe operations                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Vercel Blob Client (@vercel/blob)                  │   │
│  │  - put(): Store backup files                        │   │
│  │  - list(): List backup files                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Key Design Decisions

### 1. **JSON Format**

- ✅ Human-readable
- ✅ Easy to parse and validate
- ✅ Compatible with any restore tool
- ❌ Larger file size (vs binary)

### 2. **Vercel Blob Storage**

- ✅ Native Vercel integration
- ✅ Automatic HTTPS URLs
- ✅ Simple API
- ✅ Cost-effective
- ❌ Vendor lock-in (mitigated by JSON format)

### 3. **Daily Schedule (11:55 AM UTC)**

- ✅ Low traffic time
- ✅ Minimal impact on users
- ✅ Consistent timing
- ✅ Easy to monitor

### 4. **All Tables Backup**

- ✅ Complete data protection
- ✅ Single restore point
- ✅ Simple implementation
- ❌ Larger backup size (acceptable for current scale)

### 5. **Cron-based Trigger**

- ✅ Reliable scheduling
- ✅ No external dependencies
- ✅ Native Vercel feature
- ✅ Easy to configure

## 📝 Technical Specifications

| Specification          | Value                                       |
| ---------------------- | ------------------------------------------- |
| **Backup Format**      | JSON                                        |
| **Compression**        | None (future enhancement)                   |
| **Encryption**         | HTTPS in transit, Vercel encryption at rest |
| **Frequency**          | Daily (configurable)                        |
| **Retention**          | Unlimited (manual cleanup)                  |
| **Max Backup Size**    | Limited by Vercel function memory (1 GB)    |
| **Max Execution Time** | 10s (free), 60s (pro)                       |
| **Storage Provider**   | Vercel Blob (AWS S3 alternative available)  |
| **Authentication**     | Secret-based (BACKUP_SECRET)                |
| **API Protocol**       | REST over HTTPS                             |

---

**Architecture Version**: 1.0  
**Last Updated**: January 4, 2026  
**Status**: Production Ready ✅
