
# Fix: Equifax API Not Receiving Address Data

## Problem Analysis

The Credit Bureau (Equifax) API call is missing address data because the `equifax-credit-report` edge function reads from **non-existent columns** instead of parsing the `current_address` JSONB object.

**Current Code (BROKEN) - Lines 872-888:**
```typescript
const applicantData = {
  // ...
  dob: applicant.date_of_birth || "",      // ❌ WRONG: column is "dob" not "date_of_birth"
  address: {
    line1: applicant.address_line1 || applicant.current_address || "", // ❌ WRONG: current_address is JSONB, not string
    city: applicant.city || "",             // ❌ WRONG: no "city" column exists
    state: applicant.state || "",           // ❌ WRONG: no "state" column exists  
    postal: applicant.pincode || applicant.postal_code || "",  // ❌ WRONG: no such columns
  },
};
```

**Actual Database Structure:**
```json
current_address: {
  "line1": "S/O: Ranjit Kumar Jaiswal, ward no 3, Mahua SINGH ray...",
  "line2": "",
  "city": "",
  "state": "Bihar",
  "pincode": "844122"
}
dob: "2006-08-02"
```

## Solution

Update the `equifax-credit-report` edge function to:
1. Use the correct `dob` column (not `date_of_birth`)
2. Parse `current_address` as a JSONB object to extract `line1`, `state`, and `pincode`

## Technical Changes

### File: `supabase/functions/equifax-credit-report/index.ts`

**Replace lines 872-888:**

```typescript
// Parse current_address JSONB object
const currentAddress = applicant.current_address;
let addressLine1 = "";
let addressCity = "";
let addressState = "";
let addressPincode = "";

if (typeof currentAddress === 'object' && currentAddress !== null) {
  addressLine1 = currentAddress.line1 || "";
  addressCity = currentAddress.city || "";
  addressState = currentAddress.state || "";
  addressPincode = currentAddress.pincode || "";
} else if (typeof currentAddress === 'string') {
  // Fallback: if stored as string, use it directly
  addressLine1 = currentAddress;
}

// Prepare applicant data for API call
const applicantData = {
  firstName: applicant.first_name || "",
  middleName: applicant.middle_name || "",
  lastName: applicant.last_name || "",
  dob: applicant.dob || "",  // ← FIXED: use "dob" not "date_of_birth"
  panNumber: applicant.pan_number || "",
  aadhaarNumber: applicant.aadhaar_number || "",
  mobile: applicant.mobile || "",
  gender: applicant.gender || "",
  address: {
    line1: addressLine1,       // ← FIXED: extracted from JSONB
    city: addressCity,         // ← FIXED: extracted from JSONB
    state: addressState,       // ← FIXED: extracted from JSONB
    postal: addressPincode,    // ← FIXED: extracted from JSONB (pincode)
  },
};

// Log the extracted address for debugging
console.log("[EQUIFAX-DEBUG] Extracted address from applicant:", applicantData.address);
```

## Field Mapping Summary

| Database Field | Edge Function Variable | API Field |
|----------------|----------------------|-----------|
| `dob` | `applicantData.dob` | `DOB` |
| `current_address.line1` | `applicantData.address.line1` | `AddressLine1` |
| `current_address.state` | `applicantData.address.state` | `State` (converted to 2-letter code) |
| `current_address.pincode` | `applicantData.address.postal` | `Postal` |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Fix JSONB parsing for `current_address` and use correct `dob` column |

## Expected API Request After Fix

```xml
<InquiryAddresses>
  <InquiryAddress seq="1">
    <AddressType>H</AddressType>
    <AddressLine1>S/O: Ranjit Kumar Jaiswal, ward no 3, Mahua...</AddressLine1>
    <State>BR</State>
    <Postal>844122</Postal>
  </InquiryAddress>
</InquiryAddresses>
```

## Verification

After deployment:
1. Open Credit Bureau dialog for application `06216b35...`
2. Check that Address shows correctly in the pre-filled form
3. Click "Fetch Credit Report" - the API request will now include the proper address
4. Check edge function logs to confirm address is being passed
