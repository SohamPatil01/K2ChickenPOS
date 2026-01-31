# Analytics Not Generating - Debugging Guide

## Quick Check Steps

### Step 1: Open Analytics Page
1. Go to `/store/analytics/advanced`
2. Open browser console (F12)
3. Look for these log messages:

```
[Analytics] API responses: { forecast: 'loaded', demand: 'loaded', inventory: 'loaded' }
```

### Step 2: Check for Errors
Look for any of these errors in the console:
- **401 Unauthorized** → You're not logged in
- **403 Forbidden** → You need MANAGER or OWNER role
- **404 Not Found** → API routes not deployed yet
- **500 Server Error** → Check Vercel logs

### Step 3: Check Vercel Function Logs

**Go to Vercel Dashboard:**
1. Open your project
2. Click "Functions" tab
3. Click on `/api/v1/analytics/forecast` function
4. Look for these log messages:

```
[Analytics] Forecast Sales - Start
[Analytics] StoreId: clx...
[Analytics] Days: 7
[Analytics] Date range: { startDate: '...', endDate: '...' }
[Analytics] Found sales: X
```

## Common Issues and Solutions

### Issue 1: "Found sales: 0"

**Problem**: No sales data in database
**Solution**: You need at least 7-30 days of sales history

**How to check:**
1. Go to `/store/orders`
2. Filter for "PAID" status
3. Set date range to last 30 days
4. Check if you have sales

**If no sales:**
- Create some test sales from POS
- Make sure sales are marked as "PAID" (not "OPEN")
- Wait for at least 7 days of data for best results

### Issue 2: StoreId is "undefined" or wrong

**Problem**: User's storeId not being passed correctly
**Solution**: Check authentication

**How to fix:**
1. Log out and log back in
2. Check that your user has a storeId assigned
3. Go to browser console and type:
   ```javascript
   localStorage.getItem('auth-storage')
   ```
4. Look for `storeId` in the response

### Issue 3: Analytics shows "No Data"

**Possible causes:**

**A. Insufficient Historical Data**
- Forecast needs: 7+ days of sales
- Demand analysis needs: 30+ days of sales
- Inventory recommendations need: Active products with inventory

**B. All Sales are "OPEN" status**
- Only "PAID" sales count for analytics
- Check `/store/orders` and mark sales as paid

**C. Wrong Date Range**
- Analytics looks back 30-90 days
- Make sure you have sales in that period

### Issue 4: API Returns 404

**Problem**: Routes not deployed or incorrect URLs
**Solution**: Already fixed in latest commit

**Verify the fix:**
1. Open browser console
2. Go to Network tab
3. Refresh analytics page
4. Look for requests to `/api/v1/analytics/forecast`
5. Should return 200, not 404

### Issue 5: Analytics Partially Loading

**If only some tabs work:**
- Forecast works but Demand doesn't → Need more sales with items
- Inventory works but others don't → Need sales history
- Check Vercel logs for specific errors on each endpoint

## Minimum Data Requirements

### For Sales Forecast to Work:
```
✓ At least 1 sale in the last 30 days
✓ Sales must be "PAID" status
✓ Sales must have a grandTotal > 0
```

### For Demand Analysis to Work:
```
✓ At least 1 sale in the last 30 days
✓ Sales must have items (SaleItem records)
✓ Items must be linked to products
✓ Sales must be "PAID" status
```

### For Inventory Recommendations to Work:
```
✓ At least 1 active product
✓ Products must have inventory ledger entries
✓ Some sales history to calculate velocity
```

## Testing With Sample Data

If you have no real sales, here's how to test:

### Option 1: Create Test Sales via POS
1. Go to `/store/pos`
2. Add some products
3. Complete checkout with "CASH" payment
4. Repeat for 7-10 different days (change system date if needed)

### Option 2: Check Existing Data
Run this in your database:
```sql
-- Check sales count
SELECT COUNT(*) as total_sales, 
       COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_sales
FROM "Sale";

-- Check recent sales
SELECT "createdAt", status, "grandTotal" 
FROM "Sale" 
WHERE "createdAt" > NOW() - INTERVAL '30 days'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check products
SELECT COUNT(*) as total_products 
FROM "Product" 
WHERE "isActive" = true;
```

## What the Logs Should Show (Normal Operation)

### Successful Forecast Request:
```
[Analytics] Forecast Sales - Start
[Analytics] StoreId: clxabc123
[Analytics] Days: 7
[Analytics] Date range: { 
  startDate: '2026-01-01T00:00:00.000Z', 
  endDate: '2026-01-31T23:59:59.999Z',
  historicalDays: 30 
}
[Analytics] Found sales: 45
[Analytics] Time series created: { 
  datesCount: 30, 
  valuesCount: 30, 
  totalRevenue: 125000, 
  avgDaily: 4166.67 
}
```

### Successful Demand Request:
```
[Analytics] Predict Demand - Start
[Analytics] StoreId: clxabc123
[Analytics] Days: 30
[Analytics] Date range: { 
  startDate: '2026-01-01T00:00:00.000Z', 
  endDate: '2026-01-31T23:59:59.999Z' 
}
[Analytics] Found sales for demand: 45
```

### Successful Inventory Request:
```
[Analytics] Inventory Recommendations - Start
[Analytics] StoreId: clxabc123
[Analytics] Found products: 25
```

## Next Steps After Vercel Deployment

1. **Wait for deployment to complete** (check Vercel dashboard)

2. **Clear browser cache:**
   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
   - Or clear site data in browser settings

3. **Open analytics page:**
   - Navigate to `/store/analytics/advanced`
   - Open browser console (F12)
   - Click through all three tabs (Forecast, Demand, Inventory)

4. **Check Vercel logs:**
   - Go to Vercel Dashboard → Your Project → Functions
   - Look for `/api/v1/analytics/*` functions
   - Check Runtime Logs for any errors

5. **Share logs if still not working:**
   - Screenshot browser console errors
   - Copy Vercel function logs
   - Note which specific tab isn't working

## Expected Results

**If you have sufficient data:**
- Forecast tab: Shows historical trend chart and 7-day predictions
- Demand tab: Shows fast-moving and slow-moving products
- Inventory tab: Shows reorder recommendations

**If you have minimal data:**
- Charts may look sparse but should still appear
- Predictions may be less accurate
- Recommendations may be limited

**If you have no data:**
- Should see "No Analytics Data" message
- This is expected if you're just starting
- Add sales data and try again in a few days

## Contact Support

If analytics still doesn't work after:
1. ✅ Vercel deployment complete
2. ✅ Browser cache cleared
3. ✅ Sufficient sales data (7+ days)
4. ✅ No errors in console
5. ✅ Logged in as MANAGER or OWNER

Then share:
- Browser console screenshot
- Vercel function logs
- Sales count from orders page
- Any error messages

