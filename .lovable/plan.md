

# Fix: State Code Mapping and OCR Address Parsing

## Problem Analysis

The Equifax API is returning error `E0413 - Unexpected error occurred`. Investigation shows:

1. **Address IS being passed correctly** (that fix worked)
2. **State code is wrong**: Being sent as `"BI"` (Bihar) but should be `"RJ"` (Rajasthan)
3. **Root cause**: The `current_address.state` field contains `"Bikaner"` (a city) instead of `"Rajasthan"` (the state)

### Data Flow Issue

```text
OCR extracts: "Ward N 50, Ganga Shahar Roda Joshi Sadan, Bikaner, Rajasthan, 334001"
                                                    ↓
parse-loan-document stores: { state: "Bikaner" }  ← WRONG (city, not state)
                                                    ↓
equifax-credit-report calls: getStateCode("Bikaner")
                                                    ↓
STATE_CODES["bikaner"] → undefined (not in mapping)
                                                    ↓
Fallback: "Bikaner".substring(0,2).toUpperCase() → "BI" ← WRONG CODE
                                                    ↓
API receives State="BI" (Bihar) but postal=334001 (Rajasthan) → MISMATCH → ERROR
```

## Solution: Two-Part Fix

### Part 1: Improve State Code Fallback (Edge Function)

Instead of returning first 2 letters when no match is found, use **pincode-to-state mapping** as a fallback. Indian pincodes have state prefixes:

| Pincode Range | State |
|---------------|-------|
| 30-34 | Rajasthan (RJ) |
| 80-85 | Bihar (BR) |
| 40-44 | Maharashtra (MH) |
| etc. | ... |

### Part 2: Fix OCR Address Parsing (parse-loan-document)

Update the state extraction logic in `parse-loan-document` to better identify actual Indian states vs cities from OCR text.

## Technical Changes

### File 1: `supabase/functions/equifax-credit-report/index.ts`

**Add pincode-based state inference:**

```typescript
// Add after STATE_CODES mapping
const PINCODE_STATE_MAP: Record<string, string> = {
  "11": "DL", // Delhi
  "12": "HR", // Haryana
  "13": "PB", // Punjab
  "14": "HP", // Himachal Pradesh
  "15": "JK", // J&K
  "16": "PB", // Punjab
  "17": "HP", // Himachal
  "18": "JK", // J&K
  "19": "JK", // J&K
  "20": "UP", // UP
  "21": "UP", // UP
  "22": "UP", // UP
  "23": "UP", // UP
  "24": "UP", // UP
  "25": "UP", // UP
  "26": "UP", // UP
  "27": "UP", // UP
  "28": "UP", // UP
  "30": "RJ", // Rajasthan
  "31": "RJ", // Rajasthan
  "32": "RJ", // Rajasthan
  "33": "RJ", // Rajasthan
  "34": "RJ", // Rajasthan
  "36": "CG", // Chhattisgarh
  "40": "MH", // Maharashtra
  "41": "MH",
  "42": "MH",
  "43": "MH",
  "44": "MH",
  "45": "MP", // Madhya Pradesh
  "46": "MP",
  "47": "MP",
  "48": "MP",
  "49": "CG",
  "50": "TS", // Telangana
  "51": "TS",
  "52": "AP", // Andhra Pradesh
  "53": "AP",
  "56": "KA", // Karnataka
  "57": "KA",
  "58": "KA",
  "59": "KA",
  "60": "TN", // Tamil Nadu
  "61": "TN",
  "62": "TN",
  "63": "TN",
  "64": "TN",
  "67": "KL", // Kerala
  "68": "KL",
  "69": "KL",
  "70": "WB", // West Bengal
  "71": "WB",
  "72": "WB",
  "73": "WB",
  "74": "WB",
  "75": "OD", // Odisha
  "76": "OD",
  "77": "OD",
  "78": "AS", // Assam
  "79": "AR", // Arunachal
  "80": "BR", // Bihar
  "81": "BR",
  "82": "BR",
  "83": "BR",
  "84": "BR",
  "85": "JH", // Jharkhand
};

function getStateFromPincode(pincode: string): string {
  if (!pincode || pincode.length < 2) return "";
  const prefix = pincode.substring(0, 2);
  return PINCODE_STATE_MAP[prefix] || "";
}
```

**Update `getStateCode` function to use pincode fallback:**

```typescript
function getStateCode(state: string, pincode?: string): string {
  if (!state && !pincode) return "";
  const normalized = state?.toLowerCase().trim() || "";
  
  // Check if already a 2-letter code
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }
  
  // Try direct state name match
  const directMatch = STATE_CODES[normalized];
  if (directMatch) {
    return directMatch;
  }
  
  // Fallback: derive state from pincode
  if (pincode) {
    const fromPincode = getStateFromPincode(pincode);
    if (fromPincode) {
      console.log(`[EQUIFAX-DEBUG] State "${state}" not found, inferred ${fromPincode} from pincode ${pincode}`);
      return fromPincode;
    }
  }
  
  // Last resort: first 2 chars (may be wrong)
  return state ? state.substring(0, 2).toUpperCase() : "";
}
```

**Update the function call to pass pincode:**

```typescript
const stateCode = getStateCode(applicantData.address.state, applicantData.address.postal);
```

### File 2: `supabase/functions/parse-loan-document/index.ts`

**Improve state detection in address parsing:**

Add logic to verify extracted "state" is actually a valid Indian state, not a city:

```typescript
// List of valid Indian states for validation
const VALID_STATES = [
  'Bihar', 'Jharkhand', 'West Bengal', 'Uttar Pradesh', 'Maharashtra', 
  'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat', 'Rajasthan', 
  'Madhya Pradesh', 'Andhra Pradesh', 'Telangana', 'Kerala', 
  'Punjab', 'Haryana', 'Odisha', 'Chhattisgarh', 'Assam',
  'Himachal Pradesh', 'Uttarakhand', 'Goa', 'Tripura', 'Meghalaya',
  'Manipur', 'Nagaland', 'Arunachal Pradesh', 'Mizoram', 'Sikkim',
  'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

// When extracting state, validate it's actually a state
let state = '';
for (const s of VALID_STATES) {
  if (addressStr.toLowerCase().includes(s.toLowerCase())) {
    state = s;
    break;
  }
}
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/equifax-credit-report/index.ts` | Add pincode-to-state mapping and update `getStateCode` fallback |
| `supabase/functions/parse-loan-document/index.ts` | Improve state extraction to validate against known states |

## Expected Result After Fix

For pincode `334001` (Bikaner, Rajasthan):
- State field contains: `"Bikaner"` (city - wrong)
- Pincode-based lookup: `334001` → prefix `33` → `"RJ"` (Rajasthan - correct)
- API will receive: `State="RJ"` + `Postal="334001"` → **MATCH** → **SUCCESS**

## Verification

1. Deploy the updated edge functions
2. Retry Credit Bureau check for application `21d86346...`
3. Check logs to confirm: `State "${state}" not found, inferred RJ from pincode 334001`
4. Verify Equifax returns actual credit data instead of error

