
# Fix Nupay API Authentication - Add Missing `api-key` Header

## Problem Summary

The Nupay eMandate and E-Sign API calls are failing with **"Invalid API key"** (403 status). The error occurs because:

1. **Authentication works correctly**: The `nupay-authenticate` function gets a valid JWT token using the `api-key` header
2. **Subsequent API calls fail**: All other Nupay functions (`get-banks`, `create-mandate`, `get-status`, `esign-request`, `esign-status`) only send the `Bearer token` but are **missing the `api-key` header**

### Error from Logs
```
[Nupay-Banks] Failed to fetch banks: {"status":false,"error":"Invalid API key "}
```

### Root Cause

The Nupay API requires **BOTH** headers for all requests:
- `Authorization: Bearer <token>` ✓ (currently sent)
- `api-key: <api_key>` ✗ (missing from all functions except authenticate)

---

## Solution

Add the `api-key` header to all Nupay edge functions that make API calls. This requires:

1. Fetching the `api_key` from `nupay_config` table (currently only fetching `api_endpoint`)
2. Including `api-key` header in all `fetch()` calls to Nupay API endpoints

---

## Technical Implementation

### Files to Modify

| File | Current Issue | Fix |
|------|---------------|-----|
| `supabase/functions/nupay-get-banks/index.ts` | Only sends Bearer token | Add `api-key` header, fetch `api_key` from config |
| `supabase/functions/nupay-create-mandate/index.ts` | Only sends Bearer token | Add `api-key` header (config already fetched with `*`) |
| `supabase/functions/nupay-get-status/index.ts` | Only sends Bearer token | Add `api-key` header, fetch `api_key` from config |
| `supabase/functions/nupay-esign-request/index.ts` | Only sends Bearer token | Add `api-key` header, fetch `api_key` from config |
| `supabase/functions/nupay-esign-status/index.ts` | Only sends Bearer token | Add `api-key` header, fetch `api_key` from config |

---

### Change Pattern (Example: nupay-get-banks)

**Before:**
```typescript
// Line 96-102: Only fetching api_endpoint
const { data: config } = await supabase
  .from("nupay_config")
  .select("api_endpoint")
  .eq("org_id", org_id)
  ...

// Line 115-121: Only sending Bearer token
const banksResponse = await fetch(banksEndpoint, {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

**After:**
```typescript
// Fetch both api_endpoint AND api_key
const { data: config } = await supabase
  .from("nupay_config")
  .select("api_endpoint, api_key")
  .eq("org_id", org_id)
  ...

// Send BOTH Bearer token AND api-key header
const banksResponse = await fetch(banksEndpoint, {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`,
    "api-key": config.api_key,
    "Content-Type": "application/json",
  },
});
```

---

## Detailed Changes Per File

### 1. `nupay-get-banks/index.ts`
- Line 98: Change `.select("api_endpoint")` to `.select("api_endpoint, api_key")`
- Line 117-120: Add `"api-key": config.api_key` to headers

### 2. `nupay-create-mandate/index.ts`
- Line 129: Already using `.select("*")` so `api_key` is available
- Line 197-200: Add `"api-key": config.api_key` to headers

### 3. `nupay-get-status/index.ts`
- Line 107: Change `.select("api_endpoint")` to `.select("api_endpoint, api_key")`
- Line 126-129: Add `"api-key": config.api_key` to headers

### 4. `nupay-esign-request/index.ts`
- Line 219: Change `.select("api_endpoint")` to `.select("api_endpoint, api_key")`
- Line 260-263: Add `"api-key": config.api_key` to headers

### 5. `nupay-esign-status/index.ts`
- Check current implementation and apply same pattern

---

## Verification Steps

After deployment:

1. Go to `/los/settings/nupay` → Banks tab
2. Click "Refresh Bank List"
3. Expected: Banks load successfully instead of "Invalid API key" error

---

## Additional Recommendation: Enhanced Logging

Add diagnostic logging to help debug future issues:

```typescript
console.log(`[Nupay-Banks] Config loaded:`, {
  api_endpoint: config.api_endpoint,
  api_key_length: config.api_key?.length || 0,
  api_key_prefix: config.api_key?.substring(0, 8) + "...",
});
```

This will help verify the `api_key` is being loaded correctly without exposing the full key in logs.
