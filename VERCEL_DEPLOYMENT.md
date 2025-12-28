# Vercel Deployment Guide for K2ChickenPOS

## Quick Setup Steps

### 1. Vercel Dashboard Configuration

When importing your GitHub repository in Vercel:

1. **Root Directory**: Set to `apps/web`
   - This tells Vercel where your Next.js app is located

2. **Framework Preset**: Next.js (auto-detected)

3. **Build Settings** (usually auto-detected, but verify):
   - **Build Command**: Leave empty (auto-detects `next build`)
   - **Output Directory**: Leave empty (auto-detects `.next`)
   - **Install Command**: Leave empty (auto-detects `pnpm install`)

4. **Node.js Version**: 
   - Set to `20.x` in Project Settings → General

### 2. Environment Variables

Go to **Settings → Environment Variables** and add:

```
NEXT_PUBLIC_API_URL=https://your-api-url.com
```

**Important Notes:**
- Variables starting with `NEXT_PUBLIC_` are exposed to the browser
- Other variables (like `DATABASE_URL`, `JWT_SECRET`) are only needed if you're building server-side code that needs them
- For this frontend app, you mainly need `NEXT_PUBLIC_API_URL`

### 3. Install Command Fix

If you encounter workspace dependency issues, you may need to set a custom install command:

**In Vercel Dashboard → Settings → General → Build & Development Settings:**

Set **Install Command** to:
```bash
cd ../.. && pnpm install
```

This ensures dependencies are installed from the monorepo root.

## Common Deployment Errors & Solutions

### Error: "Cannot find module '@azela-pos/shared'"

**Cause**: Workspace dependencies not being resolved

**Solution**:
1. In Vercel Dashboard → Settings → General
2. Set **Install Command** to: `cd ../.. && pnpm install`
3. Set **Root Directory** to: `apps/web`
4. Redeploy

### Error: "Command not found: pnpm"

**Cause**: pnpm not detected

**Solution**:
1. Ensure `pnpm-lock.yaml` exists in the root (✅ it does)
2. Set Node.js version to 20.x
3. Vercel should auto-detect pnpm

### Error: "Module not found" or TypeScript errors

**Cause**: Workspace packages not being transpiled

**Solution**:
- The `next.config.js` already has `transpilePackages: ['@azela-pos/shared', '@azela-pos/offline']`
- If still failing, ensure install command runs from root

### Error: Build timeout

**Cause**: Build taking too long

**Solution**:
- Check if you're installing unnecessary dependencies
- Consider using `.vercelignore` to exclude large files
- Optimize build process

### Error: Environment variable not found

**Cause**: Variable not set or wrong prefix

**Solution**:
- Client-side variables must start with `NEXT_PUBLIC_`
- Server-side variables don't need prefix but won't be available in browser
- Redeploy after adding variables

## Step-by-Step Deployment

1. **Connect Repository**
   - Go to Vercel Dashboard
   - Click "Add New Project"
   - Import from GitHub: `SohamPatil01/K2ChickenPOS`

2. **Configure Project**
   - **Root Directory**: `apps/web`
   - **Framework**: Next.js (auto)
   - **Node Version**: 20.x

3. **Set Environment Variables**
   - `NEXT_PUBLIC_API_URL` = Your API URL

4. **Deploy**
   - Click "Deploy"
   - Monitor build logs for any errors

5. **If Build Fails**
   - Check build logs for specific error
   - Apply solutions from "Common Errors" section above
   - Update settings and redeploy

## Alternative: Manual Build Test

Test the build locally first:

```bash
# From project root
pnpm install
cd apps/web
pnpm build
```

If this works locally, the same should work on Vercel with proper configuration.

## Additional Notes

- **API Deployment**: The API server (`apps/api`) needs to be deployed separately (not on Vercel, as it's a Fastify server)
- **Database**: Database migrations should be run separately, not during Vercel build
- **Monorepo**: This is a pnpm workspace monorepo, so Vercel needs to install from root

