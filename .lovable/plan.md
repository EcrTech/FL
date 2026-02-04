
# Fix: Force Fresh Token Generation for E-Sign Step 2

## Problem Summary
The E-Sign edge function fails at **Step 2 (Process)** with error **NP004 "Login failed"** because Nupay returns the **same cached token** on consecutive authentication requests within the same second.

## Root Cause Analysis

### Evidence from Logs:
```
[E-Sign] Token 1 Auth response: {"token":"eyJ...eyJpZCI6MSwidGltZXN0YW1wIjoxNzcwMjA5OTEzfQ..."}
[E-Sign] Token 2 Auth response: {"token":"eyJ...eyJpZCI6MSwidGltZXN0YW1wIjoxNzcwMjA5OTEzfQ..."}
                                                              ^^^^^^^^^^^^^^^^^^^^
                                                              SAME TIMESTAMP = SAME TOKEN
```

Both tokens have the identical timestamp (`1770209913`), confirming Nupay is caching tokens by timestamp. When the upload (Step 1) uses the token, it becomes invalidated. Step 2 then receives the same (now-invalid) token and fails.

### Flow Diagram:
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT FLOW (BROKEN)                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Request 1 → Auth/token → Token A (timestamp 123)  →  Upload ✅             │
│  Request 2 → Auth/token → Token A (timestamp 123)  →  Process ❌ (NP004)    │
│                           ↑ SAME TOKEN (cached)                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FIXED FLOW                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Request 1 → Auth/token → Token A (timestamp 123) → Upload ✅               │
│  [WAIT 2 SECONDS]                                                           │
│  Request 2 → Auth/token → Token B (timestamp 125) → Process ✅              │
│                           ↑ NEW TOKEN (different timestamp)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Solution

Add a **2-second delay** before requesting the second token to ensure Nupay generates a new token with a different timestamp.

### Changes to `supabase/functions/nupay-esign-request/index.ts`:

**Between Step 1 and Step 2 (around line 401-404):**

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
  console.warn("[E-Sign] WARNING: Token2 is identical to Token1 - Nupay may still be caching");
}
```

---

## Technical Details

### Why the Delay Works
Nupay's JWT tokens include a `timestamp` field in the payload:
```json
{"id":1,"timestamp":1770209913}
```

When requests occur within the same second, the timestamp (and thus the token) remains identical. Adding a 2-second delay ensures the timestamp changes, forcing Nupay to generate a genuinely new token.

### Alternative Approaches Considered
1. **Retry with exponential backoff**: More complex, but could be a fallback
2. **Use session-based authentication**: Would require Nupay API changes
3. **Add timestamp as query parameter**: May not be supported by Nupay

The delay approach is the simplest and most reliable fix given the observed behavior.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/nupay-esign-request/index.ts` | Add 2-second delay before Step 2 token request, add token comparison warning |

---

## Verification Steps

After deployment:
1. Trigger E-Sign request
2. Check logs for:
   - "Waiting 2 seconds for fresh token..." message
   - Two **different** token values (different timestamps in JWT)
   - Successful NP000 response from processForSign
3. Verify signer URL is generated and accessible
