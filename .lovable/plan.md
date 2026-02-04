
# Fix: E-Sign Token Mismatch Error (NP034)

## Problem Summary
The E-Sign edge function fails at **Step 1 (Upload)** with error **NP034 "Token mismatch"**. The last edit changed the header format from `Token` to `Authorization: Bearer`, which Nupay does not accept for these endpoints.

## Root Cause Analysis

### Evidence from Logs:
```
[E-Sign] Upload response: {"StatusCode":"NP034","StatusDesc":"Token mismatch."}
```

The error occurs immediately after sending the upload request with the wrong header format.

### Header Comparison:

| Function | Header Format | Result |
|----------|--------------|--------|
| `nupay-create-mandate` | `"Token": token` | ✅ Works |
| `nupay-esign-request` (current) | `"Authorization": "Bearer ${token}"` | ❌ NP034 Error |

### Code Evidence:
The working eMandate function at line 200-205 explicitly states:
```typescript
// Use correct headers per API spec: "Token" header (not "Authorization: Bearer")
headers: {
  "api-key": config.api_key,
  "Token": token, // Correct header per API spec
```

The recent edit (shown in diff) changed eSign to use `Authorization: Bearer` format, which is incorrect.

---

## Solution

Revert the header format in `nupay-esign-request/index.ts` back to `Token` and add enhanced debugging.

### Changes to `supabase/functions/nupay-esign-request/index.ts`:

**1. Step 1 - Upload (Line 177-178):**
```typescript
// Before (broken)
headers: {
  "api-key": apiKey,
  "Authorization": `Bearer ${token}`,  // WRONG
}

// After (fixed)
headers: {
  "api-key": apiKey,
  "Token": token,  // Correct per Nupay API spec
}
```

**2. Step 2 - Process (Line 258-260):**
```typescript
// Before (broken)
headers: {
  "api-key": apiKey,
  "Authorization": `Bearer ${token}`,  // WRONG
  "Content-Type": "application/json",
}

// After (fixed)
headers: {
  "api-key": apiKey,
  "Token": token,  // Correct per Nupay API spec
  "Content-Type": "application/json",
}
```

**3. Add Enhanced Debugging (after each fetch):**
```typescript
// Add request details logging
console.log(`[E-Sign] Request headers: api-key=YES, Token=${token.substring(0, 20)}...`);
console.log(`[E-Sign] Request URL: ${endpoint}`);

// Add response details
console.log(`[E-Sign] Response status: ${response.status}`);
console.log(`[E-Sign] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries())));
console.log(`[E-Sign] Response body: ${responseText}`);
```

---

## Technical Context

### Why `Token` vs `Authorization: Bearer`?

Nupay's API documentation specifies the `Token` header for their `/api/` endpoints:
- `/api/EMandate/eManadate` - uses `Token` header ✅
- `/api/SignDocument/addRequestFile` - should use `Token` header
- `/api/SignDocument/processForSign` - should use `Token` header

The `Authorization: Bearer` format is used by Supabase's own auth system, not Nupay's API.

---

## Verification Steps

After deployment:
1. Open a loan application in disbursement stage
2. Click "E-Sign" on the Combined Loan Pack
3. Fill in signer details and submit
4. Check logs for successful upload (NP000 response)
5. Verify signer URL is generated

---

## Debug Log Enhancement

The updated function will log:
- Full request headers (masked)
- Request URL
- Response status code
- Response headers
- Full response body
- Token first 20 characters for verification
