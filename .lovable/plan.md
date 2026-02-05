
# Fix: Nupay E-Sign Status API Header Correction

## Problem Identified
Based on the provided cURL request, the Nupay SignDocument API requires the token to be passed in a `Token` header, not an `Authorization: Bearer` header.

**Correct format (from your cURL):**
```
--header 'api-key: zdJgIjc*********************'
--header 'Token: eyJ0eXAiOiJKV1QiLCJhbGc**************************************'
--header 'Content-Type: application/json'
```

## Current State Analysis

### `nupay-esign-request` (processForSign) - CORRECT
The main e-sign request function is already using the correct header format:
```typescript
// Line 262-268
headers: {
  "api-key": apiKey,
  "Token": token,  // ✅ Correct
  "Content-Type": "application/json",
}
```

### `nupay-esign-status` (documentStatus) - INCORRECT
The status check function is using the wrong header format:
```typescript
// Line 161-167
headers: {
  "Authorization": `Bearer ${token}`,  // ❌ Wrong
  "api-key": config.api_key,
  "Content-Type": "application/json",
}
```

## Solution

Update `nupay-esign-status/index.ts` to use the correct `Token` header format instead of `Authorization: Bearer`.

### Change Required

**File:** `supabase/functions/nupay-esign-status/index.ts`

**Before (Line 161-167):**
```typescript
const statusResponse = await fetch(statusEndpoint, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "api-key": config.api_key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    document_id: esignRecord.nupay_document_id,
  }),
});
```

**After:**
```typescript
const statusResponse = await fetch(statusEndpoint, {
  method: "POST",
  headers: {
    "api-key": config.api_key,
    "Token": token,  // Fixed: Use Token header like processForSign
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    document_id: esignRecord.nupay_document_id,
  }),
});
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/nupay-esign-status/index.ts` | Replace `Authorization: Bearer ${token}` with `Token: ${token}` on line 164 |

## Header Summary After Fix

| Function | Endpoint | Headers |
|----------|----------|---------|
| `nupay-esign-request` | `/api/SignDocument/processForSign` | `api-key`, `Token`, `Content-Type` |
| `nupay-esign-status` | `/api/SignDocument/documentStatus` | `api-key`, `Token`, `Content-Type` |

Both functions will now use the consistent header format that matches the Nupay API documentation.
