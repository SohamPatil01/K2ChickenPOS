# Testing Guide: Review Compliance Submissions

## Overview
This guide explains how to test the compliance submission review feature in the HQ app. This feature allows HQ owners to review compliance submissions from franchise stores.

## Prerequisites
1. Database migration completed (run `npx prisma migrate dev` if not done)
2. HQ app running on port 3002
3. API server running on port 3000
4. Logged in as HQ Owner (role: OWNER)

## Step-by-Step Testing Instructions

### Step 1: Create a Compliance Record (Store Submission)
This simulates a franchise store submitting a compliance check.

**Option A: Via API (Recommended for Testing)**
```bash
# Create a compliance record that needs review
curl -X POST http://localhost:3000/api/v1/hq/compliance/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "franchiseConfigId": "YOUR_FRANCHISE_CONFIG_ID",
    "checkType": "DAILY_CLEANING",
    "status": "COMPLIANT",
    "score": 85,
    "notes": "Daily cleaning completed. All areas sanitized.",
    "submissionData": {
      "checklist": [
        {"item": "Floor cleaned", "status": "completed"},
        {"item": "Equipment sanitized", "status": "completed"},
        {"item": "Waste disposed", "status": "completed"}
      ]
    }
  }'
```

**Option B: Via UI**
1. Navigate to `http://localhost:3002/compliance` (or `/compliance/enhanced`)
2. Click "+ Record Compliance Check"
3. Fill in the form:
   - Select a franchise
   - Choose check type (e.g., "Daily Cleaning")
   - Set status (e.g., "Compliant")
   - Add a score (0-100)
   - Add notes
   - Click "Record Check"

### Step 2: View Unreviewed Submissions
1. Go to the Compliance page in HQ app
2. You should see the compliance record you just created
3. Records that haven't been reviewed will show a **"Review"** button
4. Records that have been reviewed will show **"Reviewed ✓"**

### Step 3: Review a Submission
1. Click the **"Review"** button on any unreviewed compliance record
2. A review modal will open showing:
   - Franchise name
   - Check type
   - Submission date
   - Original submission data (if available)
   - Photos/documents (if attached)
3. In the review modal:
   - **Review Status**: Change if needed (Compliant/Warning/Non-Compliant)
   - **Score**: Adjust the score (0-100)
   - **Review Notes**: Add your review comments
4. Click **"Submit Review"**

### Step 4: Verify Review Was Saved
After submitting the review:
1. The modal should close
2. The record should update to show **"Reviewed ✓"**
3. The "Review" button should disappear
4. Refresh the page - the review status should persist

### Step 5: Check Review Details
1. Look at the compliance record card
2. It should show:
   - Updated status (if changed)
   - Updated score (if changed)
   - Review notes (if added)

## Testing Different Scenarios

### Scenario 1: Approve a Submission
- **Original Status**: COMPLIANT
- **Review Status**: COMPLIANT (keep same)
- **Score**: 90 (increase from 85)
- **Notes**: "Good work, all items completed correctly"

**Expected Result**: Record shows as reviewed, score updated to 90

### Scenario 2: Reject a Submission
- **Original Status**: COMPLIANT
- **Review Status**: NON_COMPLIANT (change)
- **Score**: 60 (decrease)
- **Notes**: "Missing documentation, please resubmit"

**Expected Result**: Record status changes to NON_COMPLIANT, score updated to 60

### Scenario 3: Issue Warning
- **Original Status**: COMPLIANT
- **Review Status**: WARNING (change)
- **Score**: 75 (decrease slightly)
- **Notes**: "Minor issues found, please address"

**Expected Result**: Record status changes to WARNING, score updated to 75

## API Testing (Direct)

### Get Compliance Records
```bash
curl -X GET "http://localhost:3000/api/v1/hq/compliance/records" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Review a Record
```bash
curl -X PATCH "http://localhost:3000/api/v1/hq/compliance/records/RECORD_ID/review" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "status": "COMPLIANT",
    "score": 90,
    "notes": "Reviewed and approved"
  }'
```

### Verify Review
```bash
curl -X GET "http://localhost:3000/api/v1/hq/compliance/records" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Check the response - the reviewed record should have:
- `reviewedBy`: User ID of reviewer
- `reviewedAt`: Timestamp of review
- Updated `status` and `score`

## Database Verification

You can also verify the review in the database:

```sql
-- Check compliance records with reviews
SELECT 
  id,
  "checkType",
  status,
  score,
  "reviewedBy",
  "reviewedAt",
  notes
FROM "ComplianceRecord"
WHERE "reviewedBy" IS NOT NULL
ORDER BY "reviewedAt" DESC;
```

## Expected Behavior

### ✅ Success Indicators
1. Review button appears on unreviewed records
2. Review modal opens with submission details
3. Review can be submitted successfully
4. Record updates to show "Reviewed ✓"
5. Review details (status, score, notes) are saved
6. Review persists after page refresh
7. Audit trail is created (check AuditLog table)

### ❌ Error Scenarios to Test
1. **Missing required fields**: Try submitting without status or score
2. **Invalid score**: Try score > 100 or < 0
3. **Network error**: Disconnect network and try to review
4. **Unauthorized access**: Try reviewing as non-OWNER user

## Troubleshooting

### Issue: "Review" button not showing
- **Check**: Is the record already reviewed? (check `reviewedBy` field)
- **Solution**: Create a new compliance record without review

### Issue: Review not saving
- **Check**: Browser console for errors
- **Check**: API response for error messages
- **Verify**: User has OWNER role
- **Verify**: Database migration completed

### Issue: Review details not updating
- **Check**: Page refresh after review
- **Check**: API response includes updated fields
- **Verify**: Database has correct `reviewedBy` and `reviewedAt` values

## Additional Features to Test

### 1. Filter by Status
- Filter records by status (Compliant/Warning/Non-Compliant)
- Verify reviewed records appear in correct filter

### 2. Filter by Check Type
- Filter by check type (Daily Cleaning, Temperature Log, etc.)
- Verify review works for all check types

### 3. Compliance Score Calculation
- Review multiple records for a franchise
- Check compliance score summary
- Verify average score updates correctly

## Notes
- Reviews are permanent (cannot be undone via UI)
- Only HQ Owners can review submissions
- Each record can only be reviewed once (reviewedBy prevents duplicate reviews)
- Review creates an audit log entry

