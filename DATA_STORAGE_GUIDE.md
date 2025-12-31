# Data Storage Guide - Where Your Data Lives

## Overview

Your POS system uses a **hybrid storage architecture** with three storage layers:

1. **Supabase PostgreSQL** - Primary database (cloud)
2. **IndexedDB** - Offline storage (browser)
3. **localStorage** - Session storage (browser)

---

## 1. Primary Database: Supabase PostgreSQL

### Location
- **Cloud Database**: Supabase (AWS-hosted PostgreSQL)
- **Connection**: `postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:6543/postgres`

### What's Stored Here
All permanent business data:

- ✅ **Users & Authentication**
  - User accounts, roles, passwords (hashed)
  - Store assignments

- ✅ **Products & Inventory**
  - Products, categories, SKUs
  - Product prices per store
  - Inventory ledger (stock movements)
  - Scale barcode configurations

- ✅ **Sales & Transactions**
  - All sales records
  - Sale items
  - Payments (cash, card, UPI)
  - Discounts and overrides

- ✅ **Customers**
  - Customer information
  - Addresses
  - Purchase history
  - Loyalty points

- ✅ **Purchase Orders**
  - PO creation and tracking
  - Stock allocations
  - GRN (Goods Receipt Notes)

- ✅ **Delivery Management**
  - Delivery orders
  - Driver assignments
  - OTP verifications
  - Delivery events

- ✅ **HQ Console Data**
  - Franchise configurations
  - Pricing plans
  - Royalty calculations
  - Compliance records
  - Alerts and notifications

### How to Access
1. **Supabase Dashboard**: https://supabase.com/dashboard
   - Go to your project
   - Click "Table Editor" to view/edit data
   - Click "SQL Editor" to run queries

2. **Prisma Studio** (Local):
   ```bash
   export DATABASE_URL="your-supabase-connection-string"
   pnpm db:studio
   ```

---

## 2. Offline Storage: IndexedDB (Browser)

### Location
- **Browser**: Each user's browser
- **Database Name**: `AzelaPOS`
- **Technology**: Dexie.js (IndexedDB wrapper)

### What's Stored Here
Temporary/cached data for offline functionality:

- ✅ **Cart Items** (`cart` table)
  - Active shopping cart
  - Items being added before checkout

- ✅ **Queued Events** (`queuedEvents` table)
  - Sales created offline
  - Events waiting to sync to server
  - Retry queue for failed syncs

- ✅ **Local Sales** (`localSales` table)
  - Sales created while offline
  - Synced to server when online

- ✅ **Cached Products** (`localProducts` table)
  - Product catalog cache
  - Prices and details
  - Last sync timestamp

- ✅ **Cached Customers** (`localCustomers` table)
  - Customer information cache
  - Last sync timestamp

### How to Access
1. **Browser DevTools**:
   - Press `F12` (or `Cmd+Option+I` on Mac)
   - Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
   - Expand **IndexedDB** → **AzelaPOS**
   - View tables: `cart`, `queuedEvents`, `localSales`, `localProducts`, `localCustomers`

2. **Clear Offline Data**:
   - Same DevTools → Application → Storage
   - Click "Clear site data" to reset offline storage

---

## 3. Session Storage: localStorage (Browser)

### Location
- **Browser**: User's browser localStorage
- **Scope**: Per domain (your Vercel app URL)

### What's Stored Here
User session and authentication:

- ✅ **Auth Tokens**
  - `accessToken` - JWT token for API calls
  - `refreshToken` - Token for refreshing access

- ✅ **User Session**
  - `auth-storage` - Zustand store with user data
  - User ID, store ID, role

### How to Access
1. **Browser DevTools**:
   - Press `F12`
   - Go to **Application** tab → **Local Storage**
   - View keys: `accessToken`, `refreshToken`, `auth-storage`

2. **Clear Session**:
   - Logout from the app (clears automatically)
   - Or manually delete from DevTools

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Action                          │
│         (Add to cart, Create sale, etc.)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Browser (Client Side)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ IndexedDB   │  │ localStorage │  │   React      │  │
│  │ (Offline)   │  │  (Session)   │  │   State      │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                │                  │          │
│         └────────────────┴──────────────────┘          │
│                        │                               │
└────────────────────────┼───────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              API Server (Vercel)                         │
│         Fastify API with Prisma ORM                      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Supabase PostgreSQL (Cloud Database)            │
│              Permanent Data Storage                      │
└─────────────────────────────────────────────────────────┘
```

---

## Data Sync Process

### When Online:
1. User action → Saved to IndexedDB immediately
2. API call → Sent to Supabase PostgreSQL
3. Response → Updates IndexedDB cache
4. UI updates → Shows latest data

### When Offline:
1. User action → Saved to IndexedDB only
2. Event queued → Added to `queuedEvents` table
3. When online → Events sync automatically
4. Server processes → Data saved to Supabase

---

## Backup & Recovery

### Supabase (Primary Database)
- ✅ **Automatic Backups**: Supabase provides daily backups
- ✅ **Point-in-time Recovery**: Available in Supabase Pro plan
- ✅ **Export Data**: Use Supabase dashboard → Database → Backups

### IndexedDB (Offline Storage)
- ⚠️ **No Automatic Backup**: Browser storage only
- ⚠️ **Cleared on**: Browser data clear, incognito mode, uninstall
- ✅ **Auto-sync**: Data syncs to Supabase when online

### Best Practices
1. **Regular Backups**: Export Supabase data regularly
2. **Monitor Sync**: Check `queuedEvents` for pending syncs
3. **Test Offline**: Verify offline functionality works
4. **Clear Cache**: Periodically clear IndexedDB if needed

---

## Viewing Your Data

### Option 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Table Editor**
4. Browse all tables and data

### Option 2: Prisma Studio
```bash
# Set your database URL
export DATABASE_URL="postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Open Prisma Studio
cd packages/db
pnpm studio
```

### Option 3: Browser DevTools
- Press `F12` → Application → IndexedDB → AzelaPOS
- View offline data and sync queue

---

## Important Notes

1. **Primary Source**: Supabase PostgreSQL is the **source of truth**
2. **Offline First**: System works offline, syncs when online
3. **Data Persistence**: Only Supabase data persists permanently
4. **Browser Storage**: IndexedDB and localStorage are per-browser
5. **Multi-Device**: Each device has its own offline storage, but shares Supabase database

---

## Troubleshooting

### Data Not Showing
- Check Supabase connection in Vercel environment variables
- Verify migrations ran successfully
- Check browser console for API errors

### Offline Data Not Syncing
- Check `queuedEvents` table in IndexedDB
- Verify API is accessible
- Check network connectivity

### Lost Data
- Check Supabase backups
- Verify data wasn't deleted from database
- Check if it's in offline queue (IndexedDB)

