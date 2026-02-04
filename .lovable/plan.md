
# Fix: E-Sign NP034 "Token Mismatch" Error

## Problem Summary
The E-Sign edge function fails at Step 2 (processForSign) with error **NP034 "Token mismatch"**, not NP004 as originally reported. The upload step succeeds but the process step fails.

## Root Cause
The eSign function requests **two separate tokens** (one for upload, one for processForSign), but Nupay expects the **same session token** for the entire document flow.

| Function | Token Strategy | Result |
|----------|---------------|--------|
| **eMandate** | Uses `nupay-authenticate` with caching | ✅ Works |
| **eSign** | Calls `getNewToken()` twice (lines 383, 397) | ❌ NP034 Token mismatch |

## Solution
Modify `nupay-esign-request/index.ts` to use a **single token for both steps** instead of requesting fresh tokens for each step.

---

## Changes Required

### File: `supabase/functions/nupay-esign-request/index.ts`

**Remove the second token request and reuse the first token:**

**Current Code (lines 381-410):**
```typescript
// Step 1: Get fresh token for upload
console.log("[E-Sign] Getting fresh token for Step 1 (Upload)...");
const token1 = await getNewToken(apiEndpoint, apiKey);

// Step 1: Upload document to Nupay
const { nupayRefNo } = await uploadDocumentToNupay(..., token1, ...);

// Step 2: Get FRESH token for processForSign (critical - tokens may be single-use)
console.log("[E-Sign] Getting fresh token for Step 2 (Process)...");
const token2 = await getNewToken(apiEndpoint, apiKey);

// Step 2: Process for signing - use FRESH token
const { signerUrl, ... } = await processForSign(..., token2, ...);
```

**Fixed Code:**
```typescript
// Get single token for the entire eSign session
console.log("[E-Sign] Getting token for eSign session...");
const token = await getNewToken(apiEndpoint, apiKey);

// Step 1: Upload document to Nupay
const { nupayRefNo } = await uploadDocumentToNupay(..., token, ...);

// Step 2: Process for signing - use SAME token (Nupay session requirement)
console.log("[E-Sign] Step 2: Using same session token for processForSign...");
const { signerUrl, ... } = await processForSign(..., token, ...);
```

---

## Technical Details

### Why This Fixes It:
- Nupay issues a session-bound token when you authenticate
- The upload (`addRequestFile`) and process (`processForSign`) calls must use the same session
- Getting a new token starts a new session that doesn't have the uploaded document

### Evidence from Database:
```
esign_response: { StatusCode: "NP034", StatusDesc: "Token mismatch." }
```

This confirms the second request is using a different session than the first.

---

## Verification Steps
After deployment:
1. Open a loan application in disbursement stage
2. Click "E-Sign" on the Combined Loan Pack
3. Fill in signer details and submit
4. Verify the request succeeds without NP034 error
5. Verify the signer URL is generated and notifications are sent
