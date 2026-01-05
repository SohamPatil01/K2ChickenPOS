# How to Access HQ App on Vercel

## ✅ Option 1: Access Through Main Web App (Already Deployed)

The HQ dashboard is **already accessible** through your main web app:

### URL:
```
https://k2-chicken-pos-web.vercel.app/hq
```

### Steps:
1. **Go to the login page:**
   ```
   https://k2-chicken-pos-web.vercel.app/login
   ```

2. **Login with OWNER credentials:**
   - Phone: Your owner phone number
   - Password: Your owner password
   - **Note:** Only users with `OWNER` role can access HQ

3. **Access HQ Dashboard:**
   - After login, navigate to: `/hq`
   - Or it will redirect automatically if you're an OWNER

### What You'll See:
- Franchise overview and management
- Sales analytics
- Inventory tracking
- Compliance monitoring
- Royalty calculations
- Health scores
- And more HQ features

---

## 🚀 Option 2: Deploy Separate HQ Web App (Dedicated App)

If you want a **separate dedicated HQ application**, deploy `apps/hq-web`:

### Step 1: Create New Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import repository: `SohamPatil01/K2ChickenPOS`

### Step 2: Configure Project Settings

- **Project Name**: `k2-chicken-pos-hq` (or any name)
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `apps/hq-web` ⚠️ **IMPORTANT**
- **Build Command**: Leave empty (auto-detects `next build`)
- **Output Directory**: Leave empty (auto-detects `.next`)
- **Install Command**: `cd ../.. && pnpm install` ⚠️ **IMPORTANT**
- **Node.js Version**: `20.x`

### Step 3: Set Environment Variables

Go to **Settings → Environment Variables** and add:

```
NEXT_PUBLIC_API_URL=https://k2-chicken-pos-api.vercel.app
```

**Important:**
- Replace with your actual API URL
- Select all environments (Production, Preview, Development)
- Click **Save**

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete
3. Your HQ app will be available at: `https://k2-chicken-pos-hq.vercel.app`

### Step 5: Access HQ App

1. **Go to login page:**
   ```
   https://k2-chicken-pos-hq.vercel.app/login
   ```

2. **Login with OWNER credentials:**
   - Phone: Your owner phone number
   - Password: Your owner password
   - **Note:** Only `OWNER` role users can access

3. **You'll be redirected to dashboard:**
   ```
   https://k2-chicken-pos-hq.vercel.app/dashboard
   ```

---

## 🔐 Authentication Requirements

**Both options require:**
- ✅ User account with `OWNER` role
- ✅ Valid login credentials
- ✅ API must be accessible (for authentication)

**If you don't have an OWNER account:**
1. Create one through the seed script (development)
2. Or create one through the API/admin interface
3. Or update an existing user's role to `OWNER` in the database

---

## 📋 Quick Reference

### Main Web App HQ Route:
```
URL: https://k2-chicken-pos-web.vercel.app/hq
Login: https://k2-chicken-pos-web.vercel.app/login
```

### Separate HQ App (if deployed):
```
URL: https://k2-chicken-pos-hq.vercel.app
Login: https://k2-chicken-pos-hq.vercel.app/login
```

### API (required for both):
```
URL: https://k2-chicken-pos-api.vercel.app
```

---

## 🛠️ Troubleshooting

### "Access denied. Only HQ Owners can access this application."

**Solution:** 
- Make sure you're logged in with an `OWNER` role account
- Check user role in database: `SELECT * FROM "User" WHERE role = 'OWNER';`

### "Login failed"

**Solution:**
- Verify API URL is correct in environment variables
- Check API is running: `https://k2-chicken-pos-api.vercel.app/health`
- Verify credentials are correct

### "Cannot connect to API"

**Solution:**
- Check `NEXT_PUBLIC_API_URL` environment variable is set
- Verify API is deployed and accessible
- Check browser console for CORS errors

---

## 📚 Related Documentation

- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)
- [API Deployment Guide](./VERCEL_API_DEPLOYMENT.md)
- [HQ Console Implementation](./HQ_CONSOLE_IMPLEMENTATION.md)

---

**Current Status:**
- ✅ Main web app deployed: `k2-chicken-pos-web.vercel.app`
- ✅ API deployed: `k2-chicken-pos-api.vercel.app`
- ✅ HQ accessible at: `/hq` route in main web app
- ⏳ Separate HQ app: Not yet deployed (optional)

