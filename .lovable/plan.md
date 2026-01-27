
## Fix: Auto-Populate DOB from Verified Sources

### Problem Summary
The applicant's Date of Birth displays "Jan 01, 1990" (a fallback default) because:
1. The `create-draft-referral-application` function defaults to `1990-01-01` when `aadhaarData.dob` is not provided
2. PAN and Aadhaar verification flows store the verified DOB in `loan_verifications.response_data` but never update `loan_applicants.dob`
3. There is no mechanism to sync verified data back to the applicant record

### Solution Overview
Update both verification edge functions to automatically update `loan_applicants.dob` when a successful verification returns a valid DOB.

---

### Files to Modify

| File | Purpose |
|------|---------|
| `supabase/functions/verifiedu-pan-verify/index.ts` | Update applicant DOB after successful PAN verification |
| `supabase/functions/verifiedu-aadhaar-details/index.ts` | Update applicant DOB after successful Aadhaar verification |

---

### Implementation Details

#### 1. Update PAN Verification Function

**File:** `supabase/functions/verifiedu-pan-verify/index.ts`

After successfully inserting the verification record, add logic to update the applicant's DOB:

```typescript
// After line 123 (after inserting loan_verifications)

// Update applicant DOB if we have a valid date from PAN verification
if (responseData.data?.dob && applicationId) {
  const { error: applicantUpdateError } = await adminClient
    .from("loan_applicants")
    .update({ dob: responseData.data.dob })
    .eq("loan_application_id", applicationId)
    .eq("applicant_type", "primary");
  
  if (applicantUpdateError) {
    console.warn("Failed to update applicant DOB from PAN:", applicantUpdateError);
  } else {
    console.log("Updated applicant DOB from PAN verification:", responseData.data.dob);
  }
}
```

#### 2. Update Aadhaar Verification Function

**File:** `supabase/functions/verifiedu-aadhaar-details/index.ts`

After successfully updating/inserting the verification record, add logic to update the applicant's DOB and other verified fields:

```typescript
// After line 200 (after updating/inserting loan_verifications)

// Update applicant record with verified data from Aadhaar
if (responseData.dob && resolvedApplicationId) {
  const updateData: Record<string, string> = {
    dob: responseData.dob,
  };
  
  // Also update gender if available
  if (responseData.gender) {
    updateData.gender = responseData.gender;
  }
  
  const { error: applicantUpdateError } = await adminClient
    .from("loan_applicants")
    .update(updateData)
    .eq("loan_application_id", resolvedApplicationId)
    .eq("applicant_type", "primary");
  
  if (applicantUpdateError) {
    console.warn("Failed to update applicant from Aadhaar:", applicantUpdateError);
  } else {
    console.log("Updated applicant from Aadhaar verification:", updateData);
  }
}
```

---

### Data Flow After Fix

```text
User completes PAN verification
    │
    ▼
verifiedu-pan-verify edge function
    │
    ├─► Inserts record into loan_verifications
    │
    └─► NEW: Updates loan_applicants.dob with verified DOB
    
User completes Aadhaar verification
    │
    ▼
verifiedu-aadhaar-details edge function
    │
    ├─► Updates loan_verifications with response
    │
    └─► NEW: Updates loan_applicants.dob (and gender) with verified data
```

---

### Technical Notes

1. **Priority:** Aadhaar DOB will overwrite PAN DOB if both verifications occur (Aadhaar is typically completed after PAN in the referral flow)

2. **Fallback Handling:** The existing fallback logic in `create-draft-referral-application` remains as a safety net for edge cases

3. **Backward Compatibility:** Existing applications won't automatically get updated DOBs, but any new verification will sync the data

4. **Admin Client Usage:** Both functions already have an admin client configured for database operations, so no additional setup is needed
