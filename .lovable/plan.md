
# Fix: E-Sign processForSign "Login failed" (NP004) Error

## Root Cause Analysis

After examining logs, code, and all three Nupay edge functions, I found the real issue:

**Nupay's SignDocument API uses different authentication headers depending on the content type:**

| Step | Endpoint | Content Type | Required Header | Current Code |
|------|----------|--------------|-----------------|--------------|
| Upload | `addRequestFile` | multipart/form-data | `Token: {jwt}` | ✅ Correct |
| Process | `processForSign` | application/json | `Authorization: Bearer {jwt}` | ❌ Wrong - using `Token` |
| Status | `documentStatus` | application/json | `Authorization: Bearer {jwt}` | ✅ Correct |

**Evidence:**
1. The working `nupay-esign-status` function (lines 161-167) uses `Authorization: Bearer` for JSON endpoints
2. Step 1 (Upload) succeeds with `Token` header (multipart/form-data)
3. Step 2 (Process) fails with `Token` header (application/json) - returns NP004 "Login failed"

The status check function at line 164 explicitly uses:
```typescript
headers: {
  "Authorization": `Bearer ${token}`,  // ← This format for JSON APIs
  "api-key": config.api_key,
  "Content-Type": "application/json",
}
```

But the esign-request function at line 264-267 incorrectly uses:
```typescript
headers: {
  "api-key": apiKey,
  "Token": token,  // ← Wrong for JSON APIs!
  "Content-Type": "application/json",
}
```

## Solution

Fix the `processForSign` function to use `Authorization: Bearer ${token}` header format, matching the working status check function.

Also remove the 2-second delay and second token generation since we now know those were not the root cause.

## Technical Changes

**File: `supabase/functions/nupay-esign-request/index.ts`**

### Change 1: Fix processForSign headers (lines 262-270)

From:
```typescript
const processResponse = await fetch(processEndpoint, {
  method: "POST",
  headers: {
    "api-key": apiKey,
    "Token": token,  // Wrong for JSON APIs
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
```

To:
```typescript
const processResponse = await fetch(processEndpoint, {
  method: "POST",
  headers: {
    "api-key": apiKey,
    "Authorization": `Bearer ${token}`,  // Correct for JSON APIs
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
```

### Change 2: Simplify token handling (lines 402-416)

Remove the unnecessary second token generation since a single token should work when the correct headers are used:

From:
```typescript
// Step 2: Process for signing - get FRESH token
// Add delay to ensure Nupay generates a new token (tokens are cached by timestamp)
console.log("[E-Sign] Step 2: Waiting 2 seconds for fresh token...");
await new Promise(resolve => setTimeout(resolve, 2000));

console.log("[E-Sign] Step 2: Getting fresh token for processForSign...");
const token2 = await getNewToken(apiEndpoint, apiKey);
console.log(`[E-Sign] Step 2: Fresh token obtained: ${token2.substring(0, 20)}...`);

// Verify tokens are different
if (token === token2) {
  console.warn("[E-Sign] WARNING: Token2 is identical to Token1");
} else {
  console.log("[E-Sign] Step 2: Confirmed tokens are different ✓");
}
```

To:
```typescript
// Step 2: Process for signing - use same token (different header format for JSON APIs)
console.log("[E-Sign] Step 2: Processing document for signing...");
```

### Change 3: Update processForSign call to use same token

Change:
```typescript
const { signerUrl, docketId, documentId: nupayDocumentId } = await processForSign(
  apiEndpoint,
  apiKey,
  token2,  // token2 is the second token
```

To:
```typescript
const { signerUrl, docketId, documentId: nupayDocumentId } = await processForSign(
  apiEndpoint,
  apiKey,
  token,   // Use same token as upload (different header format handles auth)
```

### Change 4: Update log message in processForSign (line 260)

Update the log to reflect the new header format:
```typescript
console.log(`[E-Sign] Process request headers: api-key=${apiKey.substring(0, 10)}..., Authorization=Bearer ${token.substring(0, 20)}...`);
```

## Why Previous Fixes Failed

1. **Token caching theory (2-second delay)**: We thought Nupay was caching tokens, but the issue was the header format
2. **Token header theory**: We correctly identified `Token` header for upload, but incorrectly applied it to JSON endpoints
3. **Fresh token theory**: Getting fresh tokens didn't help because the header format was still wrong

The key insight came from comparing with the **working** `nupay-esign-status` function which uses `Authorization: Bearer` for JSON APIs.

## Summary of Header Rules for Nupay SignDocument API

```text
┌─────────────────────────────────────────────────────────────────┐
│  NUPAY SIGNDOCUMENT API - AUTHENTICATION RULES                  │
├─────────────────────────────────────────────────────────────────┤
│  Multipart uploads (FormData):     Token: {jwt}                 │
│  JSON API calls (POST/GET):        Authorization: Bearer {jwt}  │
│  All requests also require:        api-key: {api_key}           │
└─────────────────────────────────────────────────────────────────┘
```

## Expected Outcome

After this fix:
- Step 1 (Upload): Uses `Token` header → ✅ NP000 (Success)
- Step 2 (Process): Uses `Authorization: Bearer` header → ✅ Should succeed
- Signer URL will be generated and returned to the user
