

# Fix: Regenerate Combined Loan Pack and Resend E-Sign

## Problem

1. Legacy Combined Loan Pack records have `file_path: null`, so E-Sign sends a 1-page placeholder instead of the full 11-page document
2. Once an E-Sign request exists, there is no way to resend the signing link or create a new E-Sign request
3. If notifications (WhatsApp/Email) failed, there is no way to retry them

## Changes

### 1. Regenerate Button (CombinedLoanPackCard.tsx)

When a Combined Loan Pack exists but has no `file_path` (legacy records), or when the user wants to regenerate:

- Detect `needsRegeneration = combinedDoc && !combinedDoc.file_path`
- Change the Generate button behavior:
  - If `needsRegeneration`: show **"Regenerate"** button (enabled)
  - If already generated with file: show **"Regenerate"** button (enabled, outline style)
  - If not generated: show **"Generate Combined Pack"** as before
- Update `handleGenerateCombined` to **update** the existing record (if one exists) instead of inserting a duplicate:
  - Upload new PDF to storage (overwrite or use new filename)
  - Update `file_path` and `document_number` on the existing record

### 2. Resend E-Sign Button (ESignDocumentButton.tsx)

When an active E-Sign request exists (pending/sent/viewed status):

- Add a **"Resend E-Sign"** button next to the status badge and refresh button
- Clicking it opens the ESignDocumentDialog to create a **new** E-Sign request
- This allows generating a fresh Nupay signing session with the latest document

### 3. Resend Notifications Button (ESignDocumentButton.tsx)

When an active E-Sign request exists and has a `signer_url`:

- Add a **"Resend Notifications"** button that re-triggers the `send-esign-notifications` edge function
- This sends the existing signing URL again via WhatsApp and Email without creating a new Nupay session

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx` | Add regeneration logic: detect missing `file_path`, enable re-generate, update existing record instead of inserting duplicate |
| `src/components/LOS/Sanction/ESignDocumentButton.tsx` | Add "Resend E-Sign" and "Resend Notifications" buttons when an active request exists |

## Technical Details

### CombinedLoanPackCard.tsx Changes

```text
Current button logic:
  disabled = isGenerating || isUploadingPdf || isCombinedGenerated || !allIndividualDocsGenerated

New button logic:
  needsRegeneration = combinedDoc && !combinedDoc.file_path
  disabled = isGenerating || isUploadingPdf || !allIndividualDocsGenerated
  label = needsRegeneration ? "Regenerate" 
        : isCombinedGenerated ? "Regenerate" 
        : "Generate Combined Pack"
```

In `handleGenerateCombined`, after uploading PDF:
```text
if (combinedDoc exists):
  UPDATE loan_generated_documents 
  SET file_path = fileName, document_number = docNumber 
  WHERE id = combinedDoc.id
else:
  INSERT new record with file_path
```

For storage upload, use `upsert: true` option to handle re-uploads to the same path.

### ESignDocumentButton.tsx Changes

When `hasActiveRequest` is true, add two extra buttons alongside the existing status badge and refresh button:

1. **"Resend E-Sign"** button: Opens the ESignDocumentDialog (same as clicking E-Sign for the first time), which creates a brand new Nupay signing session
2. **"Resend Link"** button: Calls `send-esign-notifications` edge function with the existing `signer_url` from the latest request record, re-sending the WhatsApp and Email notifications

For "Resend Link", the component will:
- Query the `signer_url` from the `esign_requests` table for the latest request
- Call `send-esign-notifications` with the applicant's contact details and the existing URL
- Show a loading state during the request and a success/error toast

## Testing Steps

1. Navigate to a loan application with an existing Combined Loan Pack (legacy, no `file_path`)
2. The button should show "Regenerate" instead of "Generated"
3. Click "Regenerate" -- PDF should be uploaded to storage and `file_path` should be populated in the database
4. Trigger E-Sign -- the full 11-page document should be sent to Nupay
5. With an active E-Sign request, click "Resend Link" to re-send WhatsApp/Email notifications
6. Click "Resend E-Sign" to create a brand new signing session with the latest document
