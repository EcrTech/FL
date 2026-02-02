
# Fix: Capture Real Aadhaar/PAN Data in Referral Applications

## Problem Summary
For referral (unauthenticated) loan applications, verified data from PAN and Aadhaar is not being stored in the `loan_applicants` table. The current flow stores **placeholder strings** instead of actual verification data.

## Root Causes

| # | Issue | File | Problem |
|---|-------|------|---------|
| 1 | Placeholder data stored | `DigilockerSuccess.tsx` | Stores "DOB verified" instead of real DOB |
| 2 | No public Aadhaar endpoint | Edge functions | `verifiedu-aadhaar-details` requires authentication |
| 3 | PAN missing DOB | `verifiedu-public-pan-verify` | Doesn't return DOB from API response |
| 4 | Draft function ignores placeholders | `create-draft-referral-application` | Falls back to default DOB (1990-01-01) |
| 5 | Submit missing fields | `submit-loan-application` | Doesn't include DOB, gender, or address in insert |

## Solution Architecture

```text
CURRENT (BROKEN):
DigiLocker → Callback → Store placeholders → Form → Submit placeholders → DB gets defaults

FIXED:
DigiLocker → Callback → Fetch REAL data (public API) → Store structured data → Form → Submit real data → DB synced
```

## Implementation Steps

### Step 1: Create Public Aadhaar Details Endpoint

Create `supabase/functions/verifiedu-public-aadhaar-details/index.ts`

A new **unauthenticated** endpoint to fetch Aadhaar details after DigiLocker verification.

Key features:
- No authentication required (public access)
- Accepts `uniqueRequestNumber` from callback
- Calls VerifiedU `GetAadhaarDetailsById` API
- Returns structured data: `aadhaar_uid`, `name`, `gender`, `dob`, and structured address
- Mock mode support when credentials not configured

Response structure:
```json
{
  "success": true,
  "data": {
    "aadhaar_uid": "XXXX-XXXX-1234",
    "name": "APPLICANT NAME",
    "gender": "Male",
    "dob": "1995-06-15",
    "addresses": [{
      "combined": "Full address string",
      "house": "123",
      "street": "Main Street",
      "locality": "Sector 5",
      "dist": "City Name",
      "state": "State Name",
      "pc": "123456"
    }]
  }
}
```

### Step 2: Update PAN Verification to Return DOB

Modify `supabase/functions/verifiedu-public-pan-verify/index.ts`

Add DOB to the response:
```typescript
return new Response(JSON.stringify({
  success: true,
  data: { 
    name: responseData.data?.name, 
    is_valid: responseData.data?.is_valid,
    dob: responseData.data?.dob  // ADD THIS
  },
}), ...);
```

Also update mock response to include mock DOB.

### Step 3: Fix DigilockerSuccess for Referral Callbacks

Modify `src/pages/DigilockerSuccess.tsx`

For referral callbacks:
1. Call the new public `verifiedu-public-aadhaar-details` endpoint
2. Wait for response before redirecting
3. Store REAL verified data in localStorage:

```typescript
const verifiedInfo = {
  name: data.name,
  dob: data.dob,
  gender: data.gender,
  address: data.addresses?.[0]?.combined || '',
  aadhaarNumber: data.aadhaar_uid,
  addressData: {
    line1: buildLine1(data.addresses[0]),
    line2: buildLine2(data.addresses[0]),
    city: data.addresses[0]?.dist,
    state: data.addresses[0]?.state,
    pincode: data.addresses[0]?.pc
  }
};
localStorage.setItem("referral_aadhaar_verified", JSON.stringify(verifiedInfo));
```

### Step 4: Update AadhaarVerificationStep to Parse Structured Data

Modify `src/components/ReferralApplication/AadhaarVerificationStep.tsx`

Update `onVerified` callback interface to include structured address:
```typescript
interface AadhaarVerificationStepProps {
  onVerified: (data: { 
    name: string; 
    address: string; 
    dob: string; 
    aadhaarNumber?: string;
    gender?: string;
    addressData?: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      pincode: string;
    };
  }) => void;
  // ...
}
```

Pass the complete verified data from localStorage to parent.

### Step 5: Update PANVerificationStep to Capture DOB

Modify `src/components/ReferralApplication/PANVerificationStep.tsx`

Update `onVerified` callback to include DOB:
```typescript
onVerified({
  name: verifyData.data?.name || 'Name retrieved',
  status: 'Verified',
  dob: verifyData.data?.dob,  // ADD THIS
});
```

### Step 6: Update Parent Component State

Modify `src/pages/ReferralLoanApplication.tsx`

Update interfaces and state to track verified data:
```typescript
interface AadhaarVerifiedData {
  name: string;
  address: string;
  dob: string;
  gender?: string;
  aadhaarNumber?: string;
  addressData?: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
  };
}

interface PanVerifiedData {
  name: string;
  status: string;
  dob?: string;
}
```

### Step 7: Update Draft Application Edge Function

Modify `supabase/functions/create-draft-referral-application/index.ts`

Accept and store structured address and DOB:
```typescript
const { referralCode, basicInfo, panNumber, aadhaarNumber, aadhaarData, panData } = body;

// Extract DOB (prefer Aadhaar, fallback to PAN, then default)
const dob = aadhaarData?.dob && aadhaarData.dob !== 'DOB verified' 
  ? aadhaarData.dob 
  : panData?.dob || '1990-01-01';

// Extract gender
const gender = aadhaarData?.gender || null;

// Build address JSONB
const currentAddress = aadhaarData?.addressData ? {
  line1: aadhaarData.addressData.line1 || '',
  line2: aadhaarData.addressData.line2 || '',
  city: aadhaarData.addressData.city || '',
  state: aadhaarData.addressData.state || '',
  pincode: aadhaarData.addressData.pincode || ''
} : null;

// Insert with complete data
.insert({
  // ...existing fields
  dob: dob,
  gender: gender,
  current_address: currentAddress,
});
```

### Step 8: Update Submit Application Edge Function

Modify `supabase/functions/submit-loan-application/index.ts`

In the referral application section, add the missing fields:
```typescript
.insert({
  loan_application_id: application.id,
  applicant_type: 'primary',
  first_name: firstName,
  last_name: lastName,
  // ...existing fields...
  dob: applicant.dob || applicant.aadhaarDob || '1990-01-01',
  gender: applicant.gender || null,
  current_address: applicant.addressData || null,
});
```

## Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `supabase/functions/verifiedu-public-aadhaar-details/index.ts` | CREATE | High |
| `supabase/functions/verifiedu-public-pan-verify/index.ts` | MODIFY | High |
| `src/pages/DigilockerSuccess.tsx` | MODIFY | High |
| `src/components/ReferralApplication/PANVerificationStep.tsx` | MODIFY | Medium |
| `src/components/ReferralApplication/AadhaarVerificationStep.tsx` | MODIFY | Medium |
| `src/pages/ReferralLoanApplication.tsx` | MODIFY | Medium |
| `supabase/functions/create-draft-referral-application/index.ts` | MODIFY | High |
| `supabase/functions/submit-loan-application/index.ts` | MODIFY | High |

## Data Flow After Fix

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FIXED DATA FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PAN VERIFICATION                                                           │
│  ┌──────────┐     ┌─────────────────────────┐     ┌──────────────────────┐ │
│  │Enter PAN │────▶│verifiedu-public-pan     │────▶│Returns: name, DOB,   │ │
│  │          │     │         -verify         │     │is_valid              │ │
│  └──────────┘     └─────────────────────────┘     └──────────────────────┘ │
│                                                             │               │
│                                                             ▼               │
│                                              Store DOB in panData state     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AADHAAR VERIFICATION                                                       │
│  ┌──────────┐     ┌─────────────────────────┐     ┌──────────────────────┐ │
│  │DigiLocker│────▶│digilocker-callback      │────▶│DigilockerSuccess.tsx │ │
│  │  Flow    │     │    (redirect)           │     │                      │ │
│  └──────────┘     └─────────────────────────┘     └──────────┬───────────┘ │
│                                                              │              │
│                   ┌─────────────────────────┐                │              │
│                   │verifiedu-public-aadhaar │◀───────────────┘              │
│                   │       -details (NEW)    │                               │
│                   └──────────────┬──────────┘                               │
│                                  │                                          │
│                                  ▼                                          │
│                   ┌──────────────────────────────────────────────────────┐  │
│                   │ Returns: name, DOB, gender, aadhaar_uid,             │  │
│                   │          addresses (house, street, locality,         │  │
│                   │                      dist, state, pincode)           │  │
│                   └──────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│                   Store in localStorage with structured addressData         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FORM SUBMISSION                                                            │
│  ┌──────────────────┐     ┌─────────────────────────┐                       │
│  │ Referral Form    │────▶│ submit-loan-application │                       │
│  │ (with real data) │     │   OR create-draft-...   │                       │
│  └──────────────────┘     └───────────┬─────────────┘                       │
│                                       │                                     │
│                                       ▼                                     │
│                           ┌─────────────────────────────────────────┐       │
│                           │        loan_applicants table            │       │
│                           │  - dob: "1995-06-15"                    │       │
│                           │  - gender: "Male"                       │       │
│                           │  - current_address: {                   │       │
│                           │      line1: "123 Main St",              │       │
│                           │      line2: "Sector 5",                 │       │
│                           │      city: "City Name",                 │       │
│                           │      state: "State Name",               │       │
│                           │      pincode: "123456"                  │       │
│                           │    }                                    │       │
│                           └─────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technical Notes

### DOB Priority Logic
When storing DOB, use this priority:
1. Aadhaar verified DOB (most authoritative)
2. PAN verified DOB (secondary)
3. Default `1990-01-01` (last resort for schema compliance)

### Placeholder Detection
Before storing DOB, check it's not a placeholder:
```typescript
const isValidDob = dob && dob !== 'DOB verified' && /^\d{4}-\d{2}-\d{2}$/.test(dob);
```

### Address Structure
The `current_address` JSONB column expects:
```json
{
  "line1": "House/Building/Street",
  "line2": "Locality/Landmark",
  "city": "District name",
  "state": "State name",
  "pincode": "6-digit PIN"
}
```

### Mock Mode
The new public Aadhaar details endpoint will support mock mode:
- Returns mock data when VerifiedU credentials not configured
- Includes `is_mock: true` flag in response
- Mock DOB: "1990-01-15", Mock Gender: "Male"
