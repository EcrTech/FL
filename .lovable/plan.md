
# Fix: Document Re-upload Details Not Updating in UI

## Overview
When a document is re-uploaded and parsed again, the extracted details are not reflected in the UI. This is caused by **incomplete query invalidation** in the frontend and **restrictive sync logic** in the backend that prevents overwriting existing data.

## Root Cause Analysis

### Issue 1: Frontend Query Invalidation Gap
After parsing, `DocumentUpload.tsx` invalidates:
- `loan-documents` (document list)
- `bank-statement-parsed` (for bank statements)

But it does **NOT** invalidate:
- `loan-application` (main query with `loan_applicants` data)
- `loan-application-basic` (used by DocumentDataVerification)

This means the applicant data synced by the edge function is never refetched.

### Issue 2: Backend Won't Overwrite Existing Data
The `parse-loan-document` edge function only syncs OCR data if fields are empty/default:

| Field | Condition to Update |
|-------|---------------------|
| DOB | Only if current = `'1990-01-01'` |
| Gender | Only if current is null/empty |
| Address | Only if current is null/empty |

When corrected data is parsed, the function sees existing values and skips the update.

### Issue 3: Local React State Not Re-syncing
`ApplicationDetail.tsx` copies `primaryApplicant` to local `applicantData` state. Even if the query refetches, the local state may not re-initialize properly.

---

## Solution

### Fix 1: Broaden Query Invalidation (Frontend)
**File:** `src/components/LOS/DocumentUpload.tsx`

After successful parsing, invalidate additional queries that display applicant/OCR data:

```typescript
// In parseMutation.onSuccess (around line 202)
onSuccess: async (data) => {
  queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
  
  // NEW: Invalidate application and applicant queries
  queryClient.invalidateQueries({ queryKey: ["loan-application"] });
  queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
  
  if (data.docType === "bank_statement") {
    queryClient.invalidateQueries({ queryKey: ["bank-statement-parsed", applicationId] });
    // Also invalidate bank details
    queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicationId] });
  }
  ...
}
```

Also update the `handleParseAll` function (around line 271) with the same invalidations.

### Fix 2: Allow Overwrite on Re-parse (Backend)
**File:** `supabase/functions/parse-loan-document/index.ts`

Modify the sync logic to update fields if the new OCR data differs from the current value:

**Before (current logic):**
```typescript
if (mergedData.dob && applicant.dob === '1990-01-01') {
  updateData.dob = mergedData.dob;
}
if (mergedData.gender && !applicant.gender) {
  updateData.gender = mergedData.gender;
}
```

**After (new logic):**
```typescript
// Update DOB if we have new data and it differs
if (mergedData.dob) {
  const newDob = mergedData.dob;
  const currentDob = applicant.dob;
  // Update if current is default OR if new value differs from current
  if (currentDob === '1990-01-01' || newDob !== currentDob) {
    const dobDate = new Date(newDob);
    if (!isNaN(dobDate.getTime())) {
      updateData.dob = newDob;
    }
  }
}

// Update gender if we have new data and current is empty or different
if (mergedData.gender) {
  const normalizedGender = mergedData.gender.toLowerCase();
  const currentGender = (applicant.gender || '').toLowerCase();
  if (!currentGender || normalizedGender !== currentGender) {
    updateData.gender = mergedData.gender;
  }
}

// Update address if we have new data
if (mergedData.address && documentType === 'aadhaar_card') {
  // Always update address from Aadhaar OCR (authoritative source)
  const addressStr = mergedData.address;
  // ... existing address parsing logic ...
  updateData.current_address = { ... };
}
```

### Fix 3: Ensure Local State Re-syncs (Frontend)
The existing `useEffect` at line 740-757 should already handle this, but we need to ensure it triggers on actual data changes:

**File:** `src/pages/LOS/ApplicationDetail.tsx`

Add more specific dependencies to ensure state updates when applicant data changes:

```typescript
useEffect(() => {
  if (primaryApplicant) {
    // ... existing logic to populate applicantData
  }
}, [
  primaryApplicant?.id,
  primaryApplicant?.gender,
  primaryApplicant?.dob,
  primaryApplicant?.current_address,
  primaryApplicant?.marital_status,
  primaryApplicant?.religion,
  primaryApplicant?.pan_number,
  primaryApplicant?.mobile
]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/LOS/DocumentUpload.tsx` | Add broader query invalidations in `parseMutation.onSuccess` and `handleParseAll` |
| `supabase/functions/parse-loan-document/index.ts` | Update sync logic to allow overwrites when data differs |
| `src/pages/LOS/ApplicationDetail.tsx` | Improve useEffect dependencies for applicantData sync |

---

## Technical Flow After Fix

```text
1. User re-uploads document
2. Document parsed via edge function
3. Edge function syncs NEW OCR values to loan_applicants (overwrites if different)
4. Frontend receives success response
5. Frontend invalidates loan-application & loan-application-basic queries
6. React Query refetches applicant data from database
7. ApplicationDetail useEffect detects changed primaryApplicant fields
8. Local applicantData state updates
9. UI reflects new values
```

---

## Verification Steps

After implementation:
1. Upload a PAN card and parse it
2. Note the extracted DOB in the UI
3. Upload a different PAN card with a different DOB
4. Re-parse the document
5. Verify the UI updates to show the new DOB
6. Check that DocumentDataVerification table also shows updated values
