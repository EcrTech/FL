

# Fix: PAN and Aadhaar Data Showing Stale/Old Information

## Problem
When PAN or Aadhaar documents are re-uploaded via the `IdentityDocumentUploadDialog`, the "Verified Document Data" section continues showing data from old/deleted documents. This happens every time documents are replaced, forcing users to repeatedly report the issue.

## Root Cause

**Missing cache invalidation in `IdentityDocumentUploadDialog.tsx`**

When a document is replaced through this dialog (line 81), it only invalidates:
```
["identity-documents", applicationId]
```

But the "Verified Document Data" section in `ApplicationDetail.tsx` uses a completely different query key:
```
["loan-documents", id]
```

This means:
1. User uploads new PAN/Aadhaar via the identity dialog
2. Old document record is deleted, new one is created (without OCR data yet)
3. The `ApplicationDetail` page never refetches because its cache (`loan-documents`) was never invalidated
4. The page continues showing the old OCR data from the stale cache

Additionally, the new document doesn't get auto-parsed, so even after a manual page refresh, the new document has no `ocr_data` and the old deleted document's data disappears entirely.

## Solution

### 1. Fix cache invalidation in `IdentityDocumentUploadDialog.tsx`

Add invalidation for ALL related query keys after upload:
- `["loan-documents", applicationId]` - for the Verified Document Data section
- `["loan-application"]` - for application-level data refresh
- `["loan-application-basic", applicationId]` - for basic app data

### 2. Auto-trigger parsing after identity document upload

After a successful upload of a PAN or Aadhaar document, automatically invoke the `parse-loan-document` edge function so the new document's OCR data is immediately available without requiring the user to manually navigate to the Documents section and click Parse.

### 3. Invalidate cache again after parsing completes

Once auto-parsing finishes, invalidate `["loan-documents", applicationId]` again so the freshly parsed data appears in the UI immediately.

## Technical Details

### File: `src/components/LOS/Verification/IdentityDocumentUploadDialog.tsx`

**Change 1 - Expand cache invalidation (line 80-83):**
Add these invalidations in `onSuccess`:
```typescript
queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
queryClient.invalidateQueries({ queryKey: ["loan-application"] });
queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
```

**Change 2 - Auto-parse after upload:**
After the document insert succeeds, call the parse function:
```typescript
// Get the newly inserted document ID
const { data: newDoc } = await supabase
  .from("loan_documents")
  .select("id, file_path")
  .eq("loan_application_id", applicationId)
  .eq("document_type", documentType)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

if (newDoc) {
  // Auto-parse in background
  supabase.functions.invoke("parse-loan-document", {
    body: { documentId: newDoc.id, documentType, filePath: newDoc.file_path },
  }).then(() => {
    queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
  });
}
```

This ensures that:
- Cache is invalidated immediately after upload (removes stale data)
- New document is auto-parsed (generates fresh OCR data)
- Cache is invalidated again after parsing (shows new data)

