
# Fix: E-Sign "Login Failed" Error (NP004)

## Problem Summary
The E-Sign edge function fails at Step 2 (processForSign) with error `"Login failed."` (NP004), even though Step 1 (upload document) succeeds with the same authentication token.

## Root Cause Analysis

### Evidence:
| Step | Endpoint | Result | Token Used |
|------|----------|--------|------------|
| Auth | `/Auth/token` | ✅ Returns JWT | N/A |
| Step 1: Upload | `/api/SignDocument/addRequestFile` | ✅ Success (NP000) | Fresh JWT |
| Step 2: Process | `/api/SignDocument/processForSign` | ❌ Login failed (NP004) | Fresh JWT |

### Diagnosis:
The same token works for upload but fails for processForSign. This strongly indicates one of:
1. **API credentials issue**: The production API key may not have eSign permissions enabled
2. **Different auth required**: Nupay may require different API key for eSign vs eMandate
3. **Account configuration**: The Nupay merchant account may need eSign module activation

## Recommended Solution

### Option A: Verify Nupay Credentials with Provider (Recommended)
**This is a configuration issue, not a code issue.** The user needs to:
1. Contact Nupay support to verify their API key has eSign module enabled
2. Confirm if eSign requires a separate API key
3. Check if their merchant account has eSign service activated

### Option B: Add Separate eSign Credentials to Config (If Needed)
If Nupay confirms a separate API key is needed for eSign:

**Database Migration:**
```sql
-- Add separate eSign API key column if Nupay requires different credentials
ALTER TABLE nupay_config 
ADD COLUMN IF NOT EXISTS esign_api_key TEXT;

COMMENT ON COLUMN nupay_config.esign_api_key IS 'Separate API key for eSign service if required by Nupay';
```

**Edge Function Update (nupay-esign-request/index.ts):**
```typescript
// Use esign_api_key if available, otherwise fall back to api_key
const apiKey = configData.esign_api_key || configData.api_key;
```

---

## Technical Details

### Current nupay_config Schema:
| Column | Value | Used For |
|--------|-------|----------|
| `api_key` | `YmFhNTIwY2...` (Base64) | eMandate + eSign (shared) |
| `api_endpoint` | `https://nupaybiz.com/autonach` | eMandate |
| `esign_api_endpoint` | `https://nupaybiz.com/autonach` | eSign |
| `esign_api_key` | ❌ **Does not exist** | - |

### What the Logs Show:
- Token obtained: `eyJ0eXAiOiJKV1QiLCJh...` decodes to `{"id": 1, "timestamp": ...}`
- The `"id": 1` suggests this may be a test/limited access token
- eMandate works because it uses the same auth successfully
- eSign's processForSign endpoint appears to have stricter auth requirements

---

## Immediate Action Items

1. **User Action Required**: Contact Nupay to:
   - Verify the production API key has eSign permissions
   - Check if eSign requires a separate API key
   - Confirm the merchant account has eSign module activated

2. **If Separate Key Needed**: I will:
   - Add `esign_api_key` column to `nupay_config`
   - Update the edge function to use the eSign-specific key
   - Add UI for entering the eSign API key in settings

---

## Questions for User
- Do you have separate API credentials from Nupay specifically for the eSign service?
- Has Nupay confirmed that your production account has the eSign module activated?
- Would you like me to add support for a separate eSign API key in the settings?
