
# Fix DOB and Address Sync from Aadhaar Verification

## Problem Summary
1. **Verified data not syncing** - The application shows default DOB (`Jan 01, 1990`) and no address despite Aadhaar verification being available
2. **Address sync is missing** - The `verifiedu-aadhaar-details` edge function currently only syncs DOB and gender, but NOT the verified address
3. **State and Pincode required** - The Aadhaar response contains `state` and `pc` (pincode) fields that must be extracted and stored

## Solution

### Update Aadhaar Verification Edge Function

**File:** `supabase/functions/verifiedu-aadhaar-details/index.ts`

Modify the applicant update logic (lines 202-224) to include address sync with proper field mapping:

```text
Aadhaar Response Fields → loan_applicants.current_address Structure
─────────────────────────────────────────────────────────────────────
addresses[0].house      ─┐
addresses[0].street      │──→ line1 (combined)
addresses[0].landmark   ─┘
addresses[0].locality   ─┐
addresses[0].vtc         │──→ line2 (combined)
addresses[0].subdist    ─┘
addresses[0].dist       ───→ city
addresses[0].state      ───→ state (MANDATORY)
addresses[0].pc         ───→ pincode (MANDATORY)
```

### Code Changes

Replace lines 202-224 with:

```typescript
// Update applicant record with verified DOB, gender, and ADDRESS from Aadhaar
if (responseData.dob || responseData.gender || responseData.addresses?.length) {
  const updateData: Record<string, unknown> = {};
  
  if (responseData.dob) {
    updateData.dob = responseData.dob;
  }
  if (responseData.gender) {
    updateData.gender = responseData.gender;
  }
  
  // NEW: Sync verified address to current_address JSONB field
  if (responseData.addresses?.length > 0) {
    const addr = responseData.addresses[0];
    
    // Build line1: house + street + landmark
    const line1Parts = [addr.house, addr.street, addr.landmark].filter(Boolean);
    const line1 = line1Parts.join(', ') || '';
    
    // Build line2: locality + vtc + subdist
    const line2Parts = [addr.locality, addr.vtc, addr.subdist].filter(Boolean);
    const line2 = line2Parts.join(', ') || '';
    
    // Extract city (dist), state, and pincode (pc) - MANDATORY fields
    const city = addr.dist || '';
    const state = addr.state || '';          // MANDATORY
    const pincode = addr.pc || '';            // MANDATORY
    
    updateData.current_address = {
      line1: line1,
      line2: line2,
      city: city,
      state: state,       // ← Extracted from Aadhaar
      pincode: pincode    // ← Extracted from Aadhaar
    };
    
    console.log("Extracted address from Aadhaar:", {
      line1, line2, city, state, pincode
    });
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

### Address Field Mapping Details

| Aadhaar API Field | Maps To | Required |
|-------------------|---------|----------|
| `house`, `street`, `landmark` | `line1` | Optional (combined) |
| `locality`, `vtc`, `subdist` | `line2` | Optional (combined) |
| `dist` | `city` | Optional |
| `state` | `state` | **MANDATORY** |
| `pc` | `pincode` | **MANDATORY** |

## Files to Modify
- `supabase/functions/verifiedu-aadhaar-details/index.ts` - Add complete address sync logic

## Verification Steps
After deployment:
1. Complete a new Aadhaar DigiLocker verification for any application
2. Check the Application Detail page → Applicant Details section
3. Verify that DOB, address, state, and pincode are all populated correctly

## Note for Existing Application
For application `6a68a59b-28e9-4648-b27f-2c376dbf799f`, the Aadhaar verification must be triggered again after this fix is deployed for the data to sync properly.
