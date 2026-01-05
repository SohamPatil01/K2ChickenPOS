# HQ Panel Not Showing - Debug Guide

## What I Just Fixed

1. **Added error state display** - Errors now show on the page instead of just alerts
2. **Added user role feedback** - Shows your role if access is denied
3. **Added retry buttons** - Can retry loading if API fails
4. **Better loading states** - Shows what's happening

## How to Debug

### Step 1: Check Browser Console
1. Open your browser's Developer Tools (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Navigate to `/hq` page
4. Look for messages starting with `[HQ Page]`
5. Check for any red error messages

### Step 2: Check Your User Role
Run this script to verify your user role:
```bash
./scripts/check-user-role.sh
```

Or manually check in your database:
```sql
SELECT id, email, name, role FROM "User" WHERE email = 'your-email@example.com';
```

Your role must be `OWNER` to access the HQ panel.

### Step 3: Check Network Requests
1. Open Developer Tools → Network tab
2. Navigate to `/hq`
3. Look for a request to `/api/v1/hq/dashboard`
4. Check the response:
   - **200 OK**: API is working, check response data
   - **401 Unauthorized**: Authentication issue
   - **403 Forbidden**: Role permission issue
   - **500 Error**: Server error, check API logs
   - **Network Error**: API not reachable

### Step 4: Check What You See
After the fix, you should see one of these:

1. **"Checking authentication..."** - User is loading
2. **"Loading HQ Dashboard..."** - Dashboard is loading
3. **"Access denied. Your role is X..."** - Wrong role
4. **Red error box with retry button** - API error
5. **Yellow box "No dashboard data available"** - Empty response
6. **Full HQ Dashboard** - Everything working!

### Step 5: Common Issues

#### Issue: Page is completely blank
**Possible causes:**
- User role is not OWNER → Check console for redirect message
- JavaScript error → Check console for errors
- Layout component issue → Check if Layout is rendering

**Fix:**
- Check browser console for errors
- Verify user role is OWNER
- Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

#### Issue: "Access denied" message
**Cause:** Your user role is not OWNER

**Fix:**
```bash
# Update your user role to OWNER
./scripts/check-user-role.sh
# Follow the prompts to update your role
```

#### Issue: "Network error" or API timeout
**Cause:** API is not accessible or slow

**Fix:**
- Check if API is deployed on Vercel
- Check Vercel deployment logs
- Verify API URL is correct in environment variables

#### Issue: "Failed to load HQ dashboard" error
**Cause:** API returned an error

**Fix:**
- Click the "Retry" button
- Check API logs on Vercel
- Verify the `/api/v1/hq/dashboard` endpoint exists
- Check if database connection is working

### Step 6: Verify API Endpoint
Test the API directly:
```bash
# Replace YOUR_TOKEN with your actual auth token
curl -X GET "https://your-api.vercel.app/api/v1/hq/dashboard?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 7: Check Vercel Logs
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Deployments" → Latest deployment
4. Click "Functions" tab
5. Check for errors in `/api/v1/hq/dashboard`

## Quick Fixes

### Fix 1: Update User Role
```bash
cd /Users/soham/Desktop/K2POS/K2ChickenPOS
./scripts/check-user-role.sh
```

### Fix 2: Clear Browser Cache
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Or clear cache: Settings → Clear browsing data

### Fix 3: Check Authentication
1. Open browser console
2. Run: `localStorage.getItem('accessToken')`
3. Should return a token string
4. If null, log in again

### Fix 4: Verify API Deployment
1. Check Vercel dashboard
2. Ensure latest commit is deployed
3. Check deployment logs for errors

## Still Not Working?

If the panel still doesn't show after trying all steps:

1. **Share the browser console output** - All messages from `[HQ Page]`
2. **Share the Network tab** - Screenshot of the `/api/v1/hq/dashboard` request
3. **Share your user role** - Output from `check-user-role.sh`
4. **Check Vercel logs** - Any errors in the API deployment

The improved error handling should now show you exactly what's wrong!

