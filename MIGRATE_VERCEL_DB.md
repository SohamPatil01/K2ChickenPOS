# How to Run Migrations on Vercel Postgres Database

## Step 1: Get Your Database URL from Vercel

1. Go to your **API project** in Vercel
2. Click **Storage** tab
3. Click on your **Postgres database**
4. Go to **.env.local** tab
5. Copy the `POSTGRES_URL` or `DATABASE_URL` value

## Step 2: Run Migrations Locally

Open your terminal and run:

```bash
# Navigate to project root
cd "/Users/soham/Downloads/k2 chicken pos 2"

# Set the DATABASE_URL to your Vercel Postgres URL
export DATABASE_URL="your-vercel-postgres-url-here"

# Run migrations (this creates all tables)
pnpm db:migrate:deploy

# Seed the database with initial data (optional but recommended)
pnpm db:seed
```

**Important:** Replace `your-vercel-postgres-url-here` with the actual connection string from Vercel.

## Step 3: Verify Migrations

After running migrations, you can verify by:

1. **Check Vercel Logs**: Go to your API project → Deployments → Latest → Functions → View Logs
2. **Test API Endpoint**: Try accessing `/health` endpoint
3. **Test Login**: Try logging in through your web app

## Alternative: Use Prisma Studio

If you want to verify the database structure:

```bash
# Set DATABASE_URL
export DATABASE_URL="your-vercel-postgres-url-here"

# Open Prisma Studio
pnpm db:studio
```

This will open a browser window where you can see all your database tables and data.

## Troubleshooting

### Error: "Can't reach database server"
- Make sure you copied the entire connection string correctly
- Check that the URL starts with `postgres://` or `postgresql://`
- Verify the database is created and active in Vercel

### Error: "Migration failed"
- Make sure you're using `db:migrate:deploy` (not `db:migrate`)
- Check that all previous migrations exist in your `packages/db/prisma/migrations` folder
- Try running migrations one at a time if needed

### Error: "Authentication failed"
- Verify the connection string is correct
- Make sure you copied the entire URL including password
- Check that the database is accessible from your IP (Vercel Postgres should be accessible)

