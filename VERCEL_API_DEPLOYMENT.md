# Vercel API Deployment Guide - Step by Step

This guide will walk you through deploying the Fastify API server to Vercel as serverless functions.

## Prerequisites

- GitHub repository connected to Vercel
- Vercel account (free tier works)
- PostgreSQL database (can be local, cloud, or Vercel Postgres)
- All environment variables ready

## Step 1: Create a New Vercel Project for API

1. **Go to Vercel Dashboard**

   - Visit [vercel.com](https://vercel.com)
   - Log in with your GitHub account

2. **Add New Project**

   - Click "Add New..." → "Project"
   - Select your repository: `SohamPatil01/K2ChickenPOS`

3. **Configure Project Settings**

   - **Project Name**: `k2chicken-pos-api` (or any name you prefer)
   - **Framework Preset**: Other (or leave blank)
   - **Root Directory**: `apps/api`
   - **Build Command**: Leave empty or set to `null` (serverless functions don't need build output)
   - **Output Directory**: Leave empty or set to `null` (IMPORTANT: This must be empty!)
   - **Install Command**: `cd ../.. && pnpm install`
   - **Node.js Version**: Select `20.x`

   **Critical**: Make sure **Output Directory** is completely empty/removed. If Vercel shows an error about "public" directory, go to Settings → General → Build & Development Settings and clear the Output Directory field.

## Step 2: Configure Environment Variables

1. **Before Deploying, Add Environment Variables**

   - In the project configuration page, scroll to "Environment Variables"
   - Click "Add" for each variable below

2. **Required Environment Variables**:

   ```
   DATABASE_URL=postgresql://username:password@host:port/database?schema=public
   JWT_SECRET=your-super-secret-jwt-key-here-min-32-chars
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-min-32-chars
   NODE_ENV=production
   API_PORT=3000
   ```

   **Important Notes:**

   - Replace `DATABASE_URL` with your actual PostgreSQL connection string
   - Generate strong secrets for JWT keys (use a password generator)
   - `API_PORT` is optional for serverless (Vercel handles ports automatically)

3. **Optional Environment Variables** (if you use them):

   ```
   REDIS_URL=redis://host:port (if using Redis for queues)
   ```

4. **Apply to All Environments**
   - Make sure to select "Production", "Preview", and "Development" for each variable
   - Click "Save" after adding each variable

## Step 3: Configure Build Settings

1. **In Project Settings → General**

   - **Root Directory**: `apps/api`
   - **Framework Preset**: Other
   - **Build Command**: (can be empty, Vercel will auto-detect)
   - **Output Directory**: (leave empty)
   - **Install Command**: `cd ../.. && pnpm install`
   - **Node.js Version**: `20.x`

2. **Advanced Settings** (if needed):
   - **Ignore Build Step**: Leave unchecked
   - **Override**: Leave as default

## Step 4: Deploy

1. **Click "Deploy"**

   - Vercel will start the build process
   - Watch the build logs for any errors

2. **Monitor Build Logs**
   - Check for TypeScript compilation errors
   - Check for missing dependencies
   - Check for environment variable issues

## Step 5: Verify Deployment

1. **Check Deployment Status**

   - Wait for build to complete (usually 2-5 minutes)
   - Look for "Ready" status

2. **Test the Health Endpoint**

   - Your API will be available at: `https://your-project-name.vercel.app`
   - Test: `https://your-project-name.vercel.app/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

3. **Test API Endpoints**
   - Try: `https://your-project-name.vercel.app/api/v1/auth/login`
   - Should return a response (even if it's an error, it means the API is working)

## Step 6: Deploy Web App and Update API URL

### First: Create Web App Project (if not already created)

If you don't have a web app project yet, create one:

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click **"Add New..."** → **"Project"**

2. **Import Repository**
   - Select your repository: `SohamPatil01/K2ChickenPOS`

3. **Configure Project Settings**
   - **Project Name**: `k2chicken-pos-web` (or any name you prefer)
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: Click "Edit" → Set to `apps/web` ⚠️ **IMPORTANT**
   - **Build Command**: Leave empty (auto-detects `next build`)
   - **Output Directory**: Leave empty (auto-detects `.next`)
   - **Install Command**: Click "Edit" → Set to `cd ../.. && pnpm install` ⚠️ **IMPORTANT**
   - **Node.js Version**: Select `20.x`

4. **Click "Deploy"**
   - Wait for the build to complete

### Then: Update Your Web App Environment Variables

1. **Update Your Web App Environment Variables**

   **Step-by-step:**
   
   a. Go to [Vercel Dashboard](https://vercel.com) and select your **web app project** (not the API project)

   b. Click **Settings** (gear icon) in the top navigation

   c. Click **Environment Variables** in the left sidebar

   d. Either:

   - **If `NEXT_PUBLIC_API_URL` exists**: Click the edit icon (pencil) next to it
   - **If it doesn't exist**: Click **Add New** button

   e. Enter:

   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: Your API URL (e.g., `https://k2-chicken-pos-api.vercel.app` or your actual API project URL)
   - **Environments**: Check all three (Production, Preview, Development)

   f. Click **Save**

2. **Redeploy Web App**

   **Option 1: Redeploy from Vercel**

   - Go to **Deployments** tab
   - Click the three dots (⋯) on the latest deployment
   - Click **Redeploy**
   - Confirm the redeploy

   **Option 2: Trigger via Git**

   - Push any commit to your repository
   - Vercel will automatically redeploy with the new environment variable

**Finding Your API URL:**

- Go to your **API project** in Vercel
- The URL is shown at the top (e.g., `https://k2-chicken-pos-api.vercel.app`)
- Or check the **Domains** section in Settings

## Troubleshooting Common Issues

### Issue 1: "Cannot find module '@azela-pos/db'"

**Solution:**

- Make sure **Install Command** is set to: `cd ../.. && pnpm install`
- This ensures workspace dependencies are installed from the monorepo root

### Issue 2: "Prisma Client not generated"

**Solution:**

- Add a build command: `cd ../.. && pnpm db:generate && pnpm build`
- Or add `postinstall` script in `apps/api/package.json`:
  ```json
  "scripts": {
    "postinstall": "cd ../.. && pnpm db:generate"
  }
  ```

### Issue 3: "Database connection error"

**Solution:**

- Verify `DATABASE_URL` is set correctly in Vercel environment variables
- Check that your database allows connections from Vercel's IP addresses
- For cloud databases, you may need to whitelist Vercel IPs

### Issue 4: "Function timeout"

**Solution:**

- Vercel free tier has 10-second timeout for serverless functions
- For longer operations, consider:
  - Using Vercel Pro (60-second timeout)
  - Moving long-running tasks to background jobs
  - Optimizing database queries

### Issue 5: "Module not found" errors

**Solution:**

- Ensure all dependencies are in `apps/api/package.json`
- Check that workspace dependencies (`@azela-pos/db`, `@azela-pos/shared`) are properly linked
- Verify `pnpm-workspace.yaml` is in the root

### Issue 6: "500 Internal Server Error"

**Solution:**

1. Check Vercel Function Logs:

   - Go to your deployment → "Functions" tab
   - Click on the function → "View Logs"
   - Look for error messages

2. Common causes:
   - Missing environment variables
   - Database connection issues
   - Prisma client not generated
   - Import path errors

## Alternative: Deploy API Separately

If you want to deploy the API as a separate project:

1. **Create a separate Vercel project** for the API
2. **Set Root Directory** to `apps/api`
3. **Use the same environment variables**
4. **Update web app** to point to the new API URL

## Database Setup Options

### Option 1: External PostgreSQL (Recommended for Production)

- Use services like:
  - **Supabase** (free tier available)
  - **Neon** (free tier available)
  - **Railway** (free tier available)
  - **AWS RDS** (paid)
  - **Google Cloud SQL** (paid)

### Option 2: Vercel Postgres

- Vercel offers managed Postgres
- Go to your project → "Storage" → "Create Database"
- Automatically provides `DATABASE_URL` environment variable

### Option 3: Local Database (Not Recommended for Production)

- Only for development/testing
- Use ngrok or similar to expose local database (not secure)

## Post-Deployment Checklist

- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] API routes are accessible
- [ ] Database connection works
- [ ] Authentication endpoints work
- [ ] CORS is configured correctly
- [ ] Environment variables are set
- [ ] Frontend is updated with new API URL
- [ ] Error logs are monitored

## Getting Your API URL

After deployment, your API will be available at:

- **Production**: `https://your-project-name.vercel.app`
- **Preview**: `https://your-project-name-git-branch.vercel.app`
- **Custom Domain**: If you configure one in Vercel settings

## Next Steps

1. **Set up custom domain** (optional):

   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Set up monitoring**:

   - Use Vercel Analytics (Pro feature)
   - Set up error tracking (Sentry, etc.)
   - Monitor function logs

3. **Optimize performance**:
   - Enable caching where appropriate
   - Optimize database queries
   - Use connection pooling for database

## Quick Reference: Vercel Dashboard Locations

- **Environment Variables**: Project Settings → Environment Variables
- **Build Logs**: Deployment → Build Logs tab
- **Function Logs**: Deployment → Functions → Click function → Logs
- **Domain Settings**: Project Settings → Domains
- **Deployment History**: Deployments tab

## Support

If you encounter issues:

1. Check Vercel Function Logs first
2. Verify all environment variables are set
3. Check build logs for compilation errors
4. Verify database connectivity
5. Check Vercel status page for outages

---

**Note**: The serverless function handler is located at `apps/api/api/index.ts` and is automatically used by Vercel based on the `vercel.json` configuration.
