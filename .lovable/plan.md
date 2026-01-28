

# Fix Equifax Address Extraction - Parse State and Pincode from Line1

## Problem Identified

The `current_address` JSONB only contains `line1` with the entire address concatenated:
```json
{
  "line1": "S/O Ramagya Pathak, HOUSE NO-323 BLOCK-L FIRST, GALI NO-6, NEAR SATNAM PUBLIC SCHOOL, SANGAM VIHAR, SANGAM VIHAR, South Dahl, Delhi-110062, Delhi, 110062"
}
```

The `state`, `city`, and `pincode` fields are **missing**, causing Equifax API to reject with error E0048.

## Solution

Add intelligent parsing in the edge function to extract pincode and state from the `line1` string when structured fields are missing.

---

## Technical Implementation

### File: `supabase/functions/equifax-credit-report/index.ts`

**Add helper functions to extract pincode and state from address string:**

```typescript
// Extract 6-digit pincode from address string
function extractPincodeFromAddress(address: string): string {
  const pincodeMatch = address.match(/\b(\d{6})\b/);
  return pincodeMatch ? pincodeMatch[1] : "";
}

// Extract state from address string (common patterns)
function extractStateFromAddress(address: string, pincode: string): string {
  // First try to get state code from pincode
  if (pincode) {
    const stateFromPincode = getStateFromPincode(pincode);
    if (stateFromPincode) return stateFromPincode;
  }
  
  // Try to match common state patterns in address
  const statePatterns = [
    /Delhi/i,
    /Maharashtra/i,
    /Karnataka/i,
    /Rajasthan/i,
    // ... etc
  ];
  
  // Map matched state names to codes
  if (/Delhi/i.test(address)) return "DL";
  if (/Maharashtra/i.test(address)) return "MH";
  // ... etc
  
  return "";
}
```

**Update address extraction logic (lines ~975-1000):**

```typescript
// After extracting from JSONB, try to parse from line1 if fields are missing
if (!addressState && addressLine1) {
  const extractedPincode = extractPincodeFromAddress(addressLine1);
  if (extractedPincode) {
    addressPincode = extractedPincode;
  }
  addressState = extractStateFromAddress(addressLine1, addressPincode);
}

if (!addressPincode && addressLine1) {
  addressPincode = extractPincodeFromAddress(addressLine1);
}
```

---

## Expected Result

For the address string:
```
"S/O Ramagya Pathak, HOUSE NO-323 BLOCK-L FIRST, ..., Delhi-110062, Delhi, 110062"
```

After parsing:
| Field | Value |
|-------|-------|
| State | `DL` |
| Postal | `110062` |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Add pincode/state extraction functions and fallback logic |

