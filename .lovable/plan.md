
# Fix: Referral Application Data and Video KYC Issues

## Problems Identified

### Problem 1: Loan Amount and Tenure Not Saved
The user submitted ₹25,000 for 30 days, but the application shows ₹50,000 for 365 days.

**Root Cause:** The parent form state initializes `requestedAmount` and `tenureDays` to `0`, while the UI components show visual defaults of ₹25,000 and 30 days. The `onUpdate` callback only fires when the user *changes* the value, so if they accept the displayed default, the parent state remains `0`, and the backend falls back to its hardcoded defaults.

| Component | Initial Value | UI Shows |
|-----------|---------------|----------|
| Parent State | 0 | - |
| LoanRequirementsScreen | formData.requestedAmount \|\| 25000 | ₹25,000 |
| ContactConsentScreen | formData.tenureDays \|\| 30 | 30 days |
| Backend Fallback | 50000 / 365 | - |

### Problem 2: Video KYC Not Reflecting
**Root Cause:** When the user completes Video KYC, it creates a draft application and links the recording to it. But when the form is submitted, the edge function creates a **new application** instead of updating the existing draft. The Video KYC recording stays orphaned on the draft.

| Step | Application ID | Status |
|------|----------------|--------|
| Draft Created | 52d7adca-... (DRAFT-...) | Has Video KYC |
| Final Submission | 2a46e6d1-... (LA-...) | **Missing** Video KYC |

---

## Solution

### Fix 1: Initialize Parent State with Correct Defaults

**File:** `src/pages/ReferralLoanApplication.tsx`

Change the initial state from:
```typescript
const [basicInfo, setBasicInfo] = useState({
  name: "",
  email: "",
  officeEmail: "",
  phone: "",
  requestedAmount: 0,  // Problem
  tenureDays: 0,       // Problem
});
```

To:
```typescript
const [basicInfo, setBasicInfo] = useState({
  name: "",
  email: "",
  officeEmail: "",
  phone: "",
  requestedAmount: 25000,  // Fixed: Match UI default
  tenureDays: 30,          // Fixed: Match UI default
});
```

### Fix 2: Update Draft Instead of Creating New Application

**File:** `supabase/functions/submit-loan-application/index.ts`

Modify the referral application handling to check for and update an existing draft:

```text
Before line 199 (Process referral application), add:
1. Check if body.draftApplicationId exists
2. If exists, fetch the draft application
3. Update the draft instead of creating new
4. Transfer all verification records and recordings
```

**Changes:**
1. Check for `body.draftApplicationId` in the request
2. If found, UPDATE the existing draft application with:
   - New application number (LA-...)
   - Verified applicant data
   - Status change to 'in_progress'
   - Current stage to 'application_login'
3. Update the applicant record attached to this draft
4. Skip creating a new application

### Fix 3: Remove Backend Fallback Defaults

**File:** `supabase/functions/submit-loan-application/index.ts`

After implementing Fix 1, we should also update the backend to use sensible product defaults rather than arbitrary values:

Change:
```typescript
requested_amount: applicant.requestedAmount || 50000,
tenure_days: applicant.tenureDays || 365,
```

To:
```typescript
requested_amount: applicant.requestedAmount || 25000,  // Match product default
tenure_days: applicant.tenureDays || 30,               // Match product default
```

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/ReferralLoanApplication.tsx` | Initialize `requestedAmount: 25000` and `tenureDays: 30` |
| `supabase/functions/submit-loan-application/index.ts` | Add draft update logic before line 199, update fallback defaults |

### Draft Update Logic (Pseudocode)

```typescript
// Check if we have an existing draft to update (for referral applications)
const draftId = body.draftApplicationId;
let application: any;
let applicationNumber: string;

if (draftId) {
  // Update existing draft
  const { data: existingDraft } = await supabase
    .from('loan_applications')
    .select('*')
    .eq('id', draftId)
    .eq('status', 'draft')
    .single();

  if (existingDraft) {
    applicationNumber = generateApplicationNumber();
    const { data: updatedApp } = await supabase
      .from('loan_applications')
      .update({
        application_number: applicationNumber,
        requested_amount: applicant.requestedAmount || 25000,
        tenure_days: applicant.tenureDays || 30,
        tenure_months: Math.ceil((applicant.tenureDays || 30) / 30),
        current_stage: 'application_login',
        status: 'in_progress',
        // ... other fields
      })
      .eq('id', draftId)
      .select()
      .single();
    
    application = updatedApp;
  }
}

// Only create new application if no draft was updated
if (!application) {
  // Existing insert logic...
}
```

---

## Expected Results After Fix

1. **Loan Amount/Tenure**: Applications will correctly reflect ₹25,000 / 30 days when user accepts defaults
2. **Video KYC**: Recording will remain attached to the same application through draft-to-submission transition
3. **Data Integrity**: All verification records (PAN, Aadhaar, Video KYC) stay linked to the final application

## Verification Steps

After implementation:
1. Submit a test referral application without changing the loan amount slider
2. Verify the application shows ₹25,000 for 30 days
3. Complete Video KYC in a new referral application
4. Verify the Video KYC recording appears in the submitted application
5. Check `loan_verifications` table shows video_kyc linked to final application ID
