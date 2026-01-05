# How to Get Your DATABASE_URL

## Option 1: From Vercel Dashboard (Vercel Postgres)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **API project**
3. Click **Storage** tab
4. Click on your **Postgres database**
5. Go to **.env.local** tab
6. Copy the `POSTGRES_URL` or `DATABASE_URL` value
7. It will look like:
   ```
   postgres://default:xxxxx@xxxxx.vercel-storage.com:5432/verceldb
   ```

## Option 2: From Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection String**
5. Select **URI** format
6. Copy the connection string
7. For scripts/migrations, use **NON-POOLING** connection (port 5432)
8. It will look like:
   ```
   postgres://postgres.xxx:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```

## Option 3: From Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **API project**
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL`
5. Click to reveal the value
6. Copy it

## After Getting the URL

Set it in your terminal:

```bash
export DATABASE_URL='your-connection-string-here'
```

Then verify it's set:

```bash
echo $DATABASE_URL
```

Then run the user role checker:

```bash
./scripts/check-user-role.sh
```

## Quick Test Connection

Test if your DATABASE_URL works:

```bash
psql "$DATABASE_URL" -c "SELECT current_database(), version();"
```

If this works, your connection is good!

