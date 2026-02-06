

# Update Nupay E-Sign Download Endpoint

## Change

**File:** `supabase/functions/nupay-esign-status/index.ts` (line 310)

Update the download endpoint path from:
```
/api/SignDocument/downloadDocument
```
to:
```
/api/SignDocument/downloadSignedDoc
```

This aligns the edge function with the correct Nupay API endpoint as specified in their documentation/cURL reference.

## Technical Detail

Single line change:
```typescript
// Before
const downloadEndpoint = `${esignApiEndpoint}/api/SignDocument/downloadDocument`;

// After
const downloadEndpoint = `${esignApiEndpoint}/api/SignDocument/downloadSignedDoc`;
```

No other changes are needed -- the request payload (`document_id`) and response handling (binary/base64) remain the same.

