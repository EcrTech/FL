
# Fix eMandate Status Not Updating After Successful Registration

## Problem Identified

The Nupay API returns status data in a **nested structure**, but the edge function is trying to access fields at the **top level**.

### Actual API Response Structure
```json
{
  "StatusCode": "NP000",
  "data": {
    "customer": {
      "accptd": "accepted",
      "umrn": "ICIC7030502261009198",
      "npci_ref_no": "123f6d3d5777b547b5b8ad9681224cd7",
      "reason_code": "000",
      "reason_desc": "accepted",
      "reject_by": "NA",
      ...
    }
  }
}
```

### Current Code (Incorrect)
```typescript
const nupayStatus = statusData.accptd || statusData.status;  // Looking at root level
const umrn = statusData.umrn || statusData.UMRN;             // Also root level
```

### What It Should Be
```typescript
const customerData = statusData.data?.customer || statusData.Data?.customer || {};
const nupayStatus = customerData.accptd || statusData.accptd;  // Check nested first
const umrn = customerData.umrn;
```

## Solution

Update `nupay-get-status/index.ts` to correctly extract data from the nested `data.customer` object.

## Implementation

### File: `supabase/functions/nupay-get-status/index.ts`

**Lines 145-162** - Update the data extraction logic:

```typescript
// Extract customer data from nested structure
// API returns: { StatusCode, data: { customer: { ... } } }
const customerData = statusData.data?.customer || statusData.Data?.customer || {};

// Map Nupay status to our status
const nupayStatus = customerData.accptd || statusData.accptd || statusData.status || statusData.Status;
let newStatus = mandate.status;

if (nupayStatus === "accepted" || nupayStatus === "Accepted" || nupayStatus === "SUCCESS") {
  newStatus = "accepted";
} else if (nupayStatus === "rejected" || nupayStatus === "Rejected" || nupayStatus === "FAILED") {
  newStatus = "rejected";
} else if (nupayStatus === "pending" || nupayStatus === "Pending") {
  newStatus = "submitted";
}

// Extract additional fields from nested customer data
const umrn = customerData.umrn || customerData.UMRN || statusData.umrn;
const npciRef = customerData.npci_ref_no || customerData.npci_ref || statusData.npci_ref;
const reasonCode = customerData.reason_code || statusData.reason_code;
const reasonDesc = customerData.reason_desc || statusData.reason_desc;
const rejectedBy = customerData.reject_by || statusData.reject_by;
```

## Technical Summary

| Location | Change |
|----------|--------|
| Line 145-146 | Add extraction of nested `data.customer` object |
| Line 146 | Check `customerData.accptd` first, then fallback to root level |
| Lines 158-162 | Extract UMRN, NPCI ref, reason codes from `customerData` |

## Why This Works

The Nupay getStatus API wraps the actual mandate data inside `data.customer`. By first extracting this nested object, we can correctly read:
- `accptd: "accepted"` → Updates status to "accepted"
- `umrn: "ICIC7030502261009198"` → Saved to mandate record
- `npci_ref_no` → NPCI reference number

After this fix, clicking "Check Status" will correctly update the mandate status from "submitted" to "accepted", and the UI will display the proper "Active" badge.
