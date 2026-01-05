# HQ Dashboard Debug Guide

## Issue: Getting Redirected to /store/pos Instead of /hq

If you're being redirected to `/store/pos` instead of accessing the HQ dashboard, follow these steps:

## Step 1: Check Your User Role

1. **Open Browser Console** (F12 or Right-click → Inspect → Console)
2. **Login to the app**
3. **Check the console logs** - You should see:
   ```
   [HQ Page] User role: OWNER
   [HQ Page] User is OWNER, loading dashboard
   ```

4. **If you see a different role** (like `MANAGER`, `CASHIER`, etc.), that's the problem!

## Step 2: Verify User Role in Database

If your role is not `OWNER`, you need to update it:

### Option A: Using Prisma Studio (Recommended)

```bash
# Set your database URL
export DATABASE_URL="your-database-url"

# Open Prisma Studio
pnpm --filter @azela-pos/db studio
```

1. Navigate to **User** table
2. Find your user account
3. Check the `role` field
4. If it's not `OWNER`, change it to `OWNER`
5. Save

### Option B: Using SQL

```sql
-- Check your current role
SELECT id, name, email, phone, role FROM "User" WHERE email = 'your-email@example.com';

-- Update to OWNER
UPDATE "User" SET role = 'OWNER' WHERE email = 'your-email@example.com';
```

## Step 3: Clear Browser Storage

After updating your role:

1. **Open Browser Console** (F12)
2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Clear Local Storage:**
   - Find `auth-storage` and delete it
   - Find `accessToken` and delete it
   - Find `refreshToken` and delete it
4. **Refresh the page**
5. **Login again**

## Step 4: Check Redirect Logic

The app redirects based on role:

- **OWNER** → `/hq` (HQ Dashboard)
- **Other roles** → `/store/pos` (Store POS)

If you're still being redirected, check:

1. **Browser Console** for error messages
2. **Network tab** to see if API calls are failing
3. **Application tab** to verify `auth-storage` contains correct role

## Step 5: Direct Access Test

Try accessing HQ directly:

1. **Login first**
2. **Then navigate to:** `https://k2-chicken-pos-web.vercel.app/hq`
3. **Check console** for redirect messages

## Common Issues

### Issue 1: "User is not OWNER, redirecting to console"

**Cause:** Your user role is not `OWNER` in the database

**Solution:** Update your role to `OWNER` (see Step 2)

### Issue 2: "No user found, redirecting to login"

**Cause:** Authentication token expired or invalid

**Solution:** 
- Clear browser storage (Step 3)
- Login again

### Issue 3: Network Error

**Cause:** API is not accessible or `NEXT_PUBLIC_API_URL` is wrong

**Solution:**
- Check Vercel environment variables
- Verify API is deployed and running
- Check browser console for API errors

## Quick Test

Run this in browser console after logging in:

```javascript
// Check stored user
const stored = localStorage.getItem('auth-storage');
if (stored) {
  const parsed = JSON.parse(stored);
  console.log('User role:', parsed.state?.user?.role);
  console.log('User:', parsed.state?.user);
} else {
  console.log('No auth storage found');
}
```

**Expected output:**
```
User role: OWNER
User: { id: "...", name: "...", role: "OWNER", ... }
```

If role is not `OWNER`, that's your problem!

## Still Not Working?

1. **Check Vercel deployment logs** for errors
2. **Check API logs** for authentication errors
3. **Verify database connection** is working
4. **Check if user exists** in database with correct role

---

**Remember:** The HQ dashboard **requires** `OWNER` role. Other roles (MANAGER, CASHIER, DRIVER) will be redirected to `/store/pos`.

