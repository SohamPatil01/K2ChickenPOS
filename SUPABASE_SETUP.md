# Setting Up Supabase Database with Vercel

## Important: Which Connection String to Use

For **Prisma migrations**, use the **NON-POOLING** connection:

```
DATABASE_POSTGRES_URL_NON_POOLING
```

For **your application** (in Vercel), use the **PRISMA URL** (with connection pooling):

```
DATABASE_POSTGRES_PRISMA_URL
```

## Step 1: Set Environment Variables in Vercel

1. Go to your **API project** in Vercel
2. Go to **Settings** → **Environment Variables**
3. Add the following variables:

### Required Variables:

**DATABASE_URL** (for Prisma - use PRISMA URL with pooling):

```
postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
```

**JWT_SECRET** (generate a strong secret, at least 32 characters):

```
your-super-secret-jwt-key-here-min-32-chars
```

**JWT_REFRESH_SECRET** (generate another strong secret):

```
your-super-secret-refresh-key-here-min-32-chars
```

**NODE_ENV**:

```
production
```

4. Make sure to select **Production**, **Preview**, and **Development** for each variable
5. Click **Save** for each variable

## Step 2: Run Migrations on Supabase Database

Open your terminal and run:

```bash
# Navigate to project root
cd "/Users/soham/Downloads/k2 chicken pos 2"

# Set DATABASE_URL to NON-POOLING connection (for migrations)
export DATABASE_URL="postgres://postgres.vkhworlflayiqinqknnk:3vv3qlkaZk9UBIFV@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Run migrations (creates all tables)
pnpm db:migrate:deploy

# Seed the database with initial data
pnpm db:seed
```

**Important:**

- Use the **NON-POOLING** URL (port 5432) for migrations
- Use the **PRISMA URL** (port 6543) in Vercel environment variables

## Step 3: Verify in Vercel

1. Go to your API project → **Settings** → **Environment Variables**
2. Verify `DATABASE_URL` is set to the PRISMA URL (port 6543)
3. Make sure all other required variables are set

## Step 4: Redeploy API

1. Go to **Deployments** tab
2. Click three dots (⋯) on latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

## Step 5: Test

1. Test health endpoint: `https://your-api-url.vercel.app/health`
2. Test login through your web app

## Troubleshooting

### Error: "Connection pooler timeout"

- Make sure you're using the PRISMA URL (port 6543) in Vercel
- The NON-POOLING URL (port 5432) is only for migrations

### Error: "SSL required"

- Make sure your connection string includes `?sslmode=require`
- Supabase requires SSL connections

### Error: "Authentication failed"

- Verify the password is correct
- Check that the connection string is complete
- Make sure you're using the correct project reference
