

# Fix: RLS Violation on PDF Upload (Storage Path Missing org_id)

## Problem

The storage RLS policy for `loan-documents` bucket requires the **first folder** in the path to match the user's `org_id`. Several upload paths are missing the `org_id` prefix, causing the "new row violates row-level security policy" error.

**Working paths** (correct pattern):
- `DocumentUpload.tsx`: `${orgId}/${applicationId}/...`
- `UploadSignedDocumentDialog.tsx`: `${orgId}/${applicationId}/signed/...`

**Broken paths** (missing `org_id`):
- `CombinedLoanPackCard.tsx`: `${applicationId}/combined_loan_pack/...`
- `CreditBureauDialog.tsx`: `${applicationId}/cibil_report_...`

## Solution

Fix the file paths in both files to include `org_id` as the first folder segment.

### File 1: `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx`

Change (line ~139):
```text
const fileName = `${applicationId}/combined_loan_pack/${docNumber}.pdf`;
```
To:
```text
const fileName = `${application.org_id}/${applicationId}/combined_loan_pack/${docNumber}.pdf`;
```

The `application.org_id` is already available via the `application` prop.

### File 2: `src/components/LOS/Verification/CreditBureauDialog.tsx`

Change (line ~182):
```text
const fileName = `${applicationId}/cibil_report_${Date.now()}.${fileExt}`;
```
To:
```text
const fileName = `${orgId}/${applicationId}/cibil_report_${Date.now()}.${fileExt}`;
```

Need to verify `orgId` is available in scope (likely from props or context).

## Impact

- Fixes the "Failed to upload PDF: new row violates row-level security policy" error on Regenerate
- Fixes any similar RLS error when uploading CIBIL reports
- No database changes needed -- the RLS policy is correct, the client code paths were wrong

