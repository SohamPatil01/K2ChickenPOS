# Features Visibility Guide - Wastage & Yield Tracking

## 🗑️ WASTAGE MANAGEMENT (`/store/wastage`)

### ✅ Real-time Validation and Feedback

**Where to see it:**
1. Navigate to `/store/wastage` (as MANAGER role)
2. Click **"+ Record Wastage"** button
3. In the modal:
   - Select a **Product** from dropdown
   - Enter **Quantity (Kg)** (e.g., 5.5)
   - **Validation box appears immediately below** the quantity field

**What you'll see:**
- **Green box** = Wastage within limits
  - Message: "✅ Wastage within limits. Current: X% (Allowed: Y%)"
  - Shows current percentage and allowed percentage
- **Red box** = Excess wastage detected
  - Message: "⚠️ Excess wastage detected! Current: X% (Allowed: Y%). Excess: Z%"
  - Shows excess amount
  - If HQ locked: Additional warning "🔒 Wastage is locked by HQ. This entry will be rejected."

### ✅ HQ Threshold Enforcement

**Where to see it:**
1. Top of the wastage page - **"Wastage Thresholds"** card
   - Shows: "Franchise Allowed Wastage: X%"
   - Shows: "Status: 🔒 Locked by HQ" or "✅ Unlocked"

2. Yellow warning banner (if locked):
   - "🔒 Wastage thresholds are locked by HQ. Excess wastage entries will be rejected."

3. In validation box:
   - If excess + locked: Button is **disabled** (grayed out)
   - Error message prevents submission

### ✅ Visual Indicators

**Color Coding:**
- 🟢 **Green** = Within limits
- 🔴 **Red** = Excess wastage
- 🟡 **Yellow** = Lock warning banner

**Status Badges:**
- "🔒 Locked by HQ" (red/yellow)
- "✅ Unlocked" (green)

### ✅ Role-Based Access

**How to verify:**
1. Login as CASHIER → Navigate to `/store/wastage`
   - Should redirect to `/store` (dashboard)
2. Login as MANAGER → Navigate to `/store/wastage`
   - Page loads successfully
   - All features visible

### ✅ Integration with Inventory System

**Where to see it:**
1. **Recent Wastage Entries** table (bottom of page)
   - Shows last 7 days of wastage entries
   - Displays: Date, Product, Type (Cutting Loss/Spoilage), Quantity, Reason
   - Data comes from `/api/v1/inventory/ledger` with reason='WASTAGE'

2. After recording wastage:
   - Entry appears in the table
   - Stock ledger updated automatically
   - Inventory deducted

---

## 📊 YIELD TRACKING (`/store/yield`)

### ✅ Real-time Yield Calculation

**Where to see it:**
1. Navigate to `/store/yield` (as MANAGER role)
2. Click **"+ Record Yield"** button
3. In the modal:
   - Enter **Whole Chicken Weight** (e.g., 2.5 kg)
   - Click **"+ Add Cut"** button
   - Select cut type and enter weight
   - **Yield calculation box appears immediately** below cuts section

**What you'll see:**
- **Total Cut Weight**: Sum of all cut weights
- **Yield %**: Calculated as (Total Cut Weight / Whole Chicken Weight) × 100
- **Progress Bar**: Visual indicator showing target achievement
- **Color Coding**:
  - 🟢 Green = 90%+ of expected yield
  - 🟡 Yellow = 80-90% of expected yield
  - 🔴 Red = <80% of expected yield

### ✅ Daily Yield Summary

**Where to see it:**
1. Top section of yield page - **"Daily Yield Summary"** card
2. **Date selector** on the right - select any date
3. Summary shows:
   - **Total Whole Chicken Weight** (kg)
   - **Total Cut Weight** (kg)
   - **Yield %** with progress bar
   - Color-coded based on performance

**Visual Elements:**
- Three metric cards with large numbers
- Progress bar below yield percentage
- Target indicator showing expected yield

### ✅ Historical Tracking

**Where to see it:**
1. **Date selector** in Daily Summary section
2. Change date to view different days
3. **Yield Entries** table (below summary)
   - Shows all entries for selected date
   - Columns: Time, Whole Chicken (kg), Cut Weight (kg), Yield %
   - Color-coded yield percentages

### ✅ Visual Indicators

**Progress Bars:**
- Horizontal bars showing yield achievement
- Green/Yellow/Red based on performance
- Percentage width shows how close to target

**Color Coding:**
- 🟢 **Green** = Excellent (90%+ of target)
- 🟡 **Yellow** = Good (80-90% of target)
- 🔴 **Red** = Needs improvement (<80% of target)

**Status Messages:**
- "✅ Above Target" or "⚠️ Below Target"

### ✅ Role-Based Access

**How to verify:**
1. Login as CASHIER → Navigate to `/store/yield`
   - Should redirect to `/store` (dashboard)
2. Login as MANAGER → Navigate to `/store/yield`
   - Page loads successfully
   - All features visible

---

## 🔍 Troubleshooting

### If validation doesn't appear:

1. **Check browser console** for errors
2. **Verify product is selected** and quantity > 0
3. **Check network tab** - API calls should succeed
4. **Refresh page** and try again

### If daily summary is empty:

1. **Record at least one yield entry** first
2. **Check date selector** - make sure it matches entry date
3. **Check localStorage** - yield data stored there temporarily

### If features don't load:

1. **Verify user role** - must be MANAGER
2. **Check API endpoints** are accessible
3. **Verify franchise config** exists for your store
4. **Check browser console** for specific errors

---

## 📝 Quick Test Steps

### Test Wastage Management:

1. Login as MANAGER
2. Go to `/store/wastage`
3. Click "+ Record Wastage"
4. Select a product
5. Enter quantity (e.g., 10 kg)
6. **✅ Validation box should appear immediately**
7. Check if it's green (OK) or red (Excess)
8. Fill in reason and submit
9. Check "Recent Wastage Entries" table - entry should appear

### Test Yield Tracking:

1. Login as MANAGER
2. Go to `/store/yield`
3. Click "+ Record Yield"
4. Enter whole chicken weight (e.g., 2.5 kg)
5. Click "+ Add Cut"
6. Select cut type and enter weight (e.g., 1.0 kg)
7. **✅ Yield calculation box should appear**
8. Check yield percentage and progress bar
9. Add more cuts if needed
10. Submit and check daily summary

---

## 🎯 Key Visual Elements to Look For

### Wastage Page:
- ✅ Yellow lock warning banner (if HQ locked)
- ✅ Threshold info card (top section)
- ✅ Validation box in modal (green/red)
- ✅ Recent wastage table (bottom)

### Yield Page:
- ✅ Daily summary card (top)
- ✅ Date selector
- ✅ Progress bars
- ✅ Color-coded percentages
- ✅ Yield entries table

All features are implemented and should be visible when you:
1. Login as MANAGER
2. Navigate to the respective pages
3. Interact with the forms

