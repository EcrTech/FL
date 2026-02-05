

# Fix: Download Signed Document from Nupay

## Problem Summary

The "View Signed Document" button is not showing because the signed PDF is never downloaded. The Nupay `documentStatus` API only returns the signing status, not the actual signed document. A separate download API call is required.

## Current Behavior

1. User signs the document via Nupay
2. "Check Status" correctly updates status to "signed"
3. `signed_document_path` stays NULL (no document downloaded)
4. "View Signed Document" button never appears

## Solution

Add a new API call to Nupay's document download endpoint after detecting "signed" status.

### Technical Details

Based on Nupay's API patterns, the signed document is likely available at:
- `/api/SignDocument/downloadDocument` with the `document_id`

### Changes Required

#### 1. Update `nupay-esign-status/index.ts`

Add document download logic after status is "signed":

```text
┌─────────────────────────────────────────────────────┐
│  Current Flow                                        │
├─────────────────────────────────────────────────────┤
│  1. Call documentStatus API                         │
│  2. Check if signed_document in response (NONE)     │
│  3. Update status to "signed"                       │
│  4. signed_document_path = NULL                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  New Flow                                           │
├─────────────────────────────────────────────────────┤
│  1. Call documentStatus API                         │
│  2. If status = "signed":                           │
│     a. Call downloadDocument API                    │
│     b. Receive signed PDF                           │
│     c. Upload to Supabase Storage                   │
│  3. Update status with signed_document_path         │
└─────────────────────────────────────────────────────┘
```

**New Code to Add (after line 220):**

```typescript
// If no document in status response, try separate download API
if (!signedDocBase64 && !signedDocUrl && esignRecord.nupay_document_id) {
  console.log("[E-Sign-Status] Trying separate download API");
  
  // Get fresh token for download
  const downloadToken = await getNewToken(baseEndpoint, config.api_key);
  
  const downloadEndpoint = `${baseEndpoint}/api/SignDocument/downloadDocument`;
  const downloadResponse = await fetch(downloadEndpoint, {
    method: "POST",
    headers: {
      "api-key": config.api_key,
      "Token": downloadToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: esignRecord.nupay_document_id,
    }),
  });
  
  if (downloadResponse.ok) {
    const contentType = downloadResponse.headers.get("content-type");
    if (contentType?.includes("application/pdf")) {
      // Direct PDF binary
      const arrayBuffer = await downloadResponse.arrayBuffer();
      pdfBuffer = new Uint8Array(arrayBuffer);
    } else {
      // JSON with base64 or URL
      const downloadData = await downloadResponse.json();
      signedDocBase64 = downloadData.Data?.document || downloadData.document;
      signedDocUrl = downloadData.Data?.document_url || downloadData.document_url;
    }
  }
}
```

#### 2. Add Token Helper Function

Copy the `getNewToken` helper function from `nupay-esign-request/index.ts` to `nupay-esign-status/index.ts`.

#### 3. Alternative: Ask User for Correct Download Endpoint

Since the exact Nupay download endpoint is unknown, we may need to ask you for the correct cURL command from Nupay documentation for downloading signed documents.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/nupay-esign-status/index.ts` | Add separate download API call for signed documents |

## Questions for You

Before implementing, could you confirm:

1. **Do you have documentation for the Nupay download signed document API?** (Similar to how you provided the cURL for `processForSign`)

2. **Or should I try the endpoint `/api/SignDocument/downloadDocument` with the document_id?**

If you don't have the documentation, I can implement a trial approach and we can debug from the logs.

