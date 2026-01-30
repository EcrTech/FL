
# Fix E-Sign Signer URL Extraction

## Issue Identified
The `nupay-esign-request` Edge Function fails to extract the signer URL from Nupay's `processForSign` response due to incorrect field path mapping.

**Current Code (lines 282-288):**
```typescript
const signerUrl = processData.signer_url || 
                  processData.data?.signer_url ||
                  processData.SignerUrl ||
                  processData.data?.SignerUrl ||
                  processData.data?.signer_info?.[0]?.signer_url ||
                  processData.signer_info?.[0]?.signer_url;
```

**Problem:**
- Nupay returns `Data` (capital D), not `data`
- The field is `url`, not `signer_url`
- Correct path: `processData.Data.signer_info[0].url`

## Solution
Update the signer URL extraction chain in `processForSign` function to include the correct Nupay response structure.

**File:** `supabase/functions/nupay-esign-request/index.ts`

**Change (lines 282-288):**
```typescript
const signerUrl = processData.Data?.signer_info?.[0]?.url ||
                  processData.data?.signer_info?.[0]?.url ||
                  processData.Data?.signer_info?.[0]?.signer_url ||
                  processData.data?.signer_info?.[0]?.signer_url ||
                  processData.signer_url || 
                  processData.data?.signer_url ||
                  processData.SignerUrl ||
                  processData.data?.SignerUrl ||
                  processData.signer_info?.[0]?.signer_url ||
                  processData.signer_info?.[0]?.url;
```

This prioritizes the correct Nupay path (`Data.signer_info[0].url`) while maintaining backward compatibility with other possible response formats.

---

## Technical Details

### Root Cause Analysis
The Nupay API response structure uses:
- **PascalCase** for top-level keys (e.g., `Data`, `StatusCode`)
- **snake_case** for nested keys (e.g., `signer_info`, `url`)

### Why This Matters
When `processForSign` API returns success (`NP000`) but the URL extraction returns `undefined`, the function throws "No signer URL received from Nupay" even though the data is present in the response.

### Testing
After deployment, test the E-Sign flow on a sanctioned loan application:
1. Navigate to a loan in "Sanctioned" status
2. Click "E-Sign" on Sanction Letter
3. Fill in signer details and submit
4. Verify that the signer URL is returned and stored
