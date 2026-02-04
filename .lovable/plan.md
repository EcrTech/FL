
# Fix: eMandate Response Parsing Bug

## Problem Summary
When the Nupay API returns a successful mandate creation response, the `nupay_id`, `nupay_ref_no`, and `registration_url` are not being extracted and saved to the database. This means mandates appear as "submitted" but without the registration URL needed for users to complete authorization.

## Root Cause
The Nupay API returns data in a **nested structure**, but the edge function looks for values at the **top level**.

### Actual Nupay Response Structure
```text
{
  "StatusCode": "NP000",
  "StatusDesc": "Data submitted successfully",
  "data": {
    "customer": {
      "id": "21bf3dcl",           <-- Mandate ID is HERE
      "nupay_ref_no": "NP71177001834056367"  <-- Reference is HERE
    },
    "url": "https://uat.nupay.net?c=21bf3dcl"  <-- URL is HERE
  }
}
```

### Current Code (Incorrect)
```text
const nupayId = responseData.id || responseData.Id;
const nupayRefNo = responseData.ref_no || responseData.RefNo;
const registrationUrl = responseData.registration_url || responseData.url;
```

These all return `undefined` because they look at the wrong nesting level.

---

## Solution

### File to Modify
`supabase/functions/nupay-create-mandate/index.ts`

### Changes Required

Update lines 224-226 to correctly navigate the nested response structure:

**Before:**
```typescript
const nupayId = responseData.id || responseData.Id || responseData.uniq_id;
const nupayRefNo = responseData.ref_no || responseData.RefNo || responseData.reference_no;
const registrationUrl = responseData.registration_url || responseData.RegistrationUrl || responseData.url;
```

**After:**
```typescript
// Nupay API returns data nested under data.customer and data.url
const customerData = responseData.data?.customer;
const nupayId = customerData?.id || responseData.id || responseData.Id;
const nupayRefNo = customerData?.nupay_ref_no || responseData.ref_no || responseData.RefNo;
const registrationUrl = responseData.data?.url || responseData.url || responseData.registration_url;
```

Additionally, add logging to help debug future issues:
```typescript
console.log(`[Nupay-CreateMandate] Extracted - nupayId: ${nupayId}, refNo: ${nupayRefNo}, url: ${registrationUrl}`);
```

---

## Verification Steps

After deploying:
1. Navigate to a loan application in disbursement stage
2. Open the eMandate section
3. Fill in bank details and submit
4. Verify the `nupay_mandates` table now has:
   - `nupay_id` populated (e.g., "21bf3dcl")
   - `nupay_ref_no` populated (e.g., "NP71177001834056367")
   - `registration_url` populated (e.g., "https://uat.nupay.net?c=...")
5. Confirm the registration URL/QR code appears in the UI

---

## Technical Details

| Field | Correct Path | Fallback Paths |
|-------|-------------|----------------|
| Mandate ID | `data.customer.id` | `id`, `Id` |
| Reference No | `data.customer.nupay_ref_no` | `ref_no`, `RefNo` |
| Registration URL | `data.url` | `url`, `registration_url` |
