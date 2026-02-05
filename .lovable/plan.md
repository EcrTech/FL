
# Add Upload Signed Document Option to Combined Loan Pack

## Problem Summary

The Combined Loan Pack card currently supports:
- Generating the combined document
- Downloading and printing
- E-signing via Nupay
- Viewing signed documents (when available)

**Missing**: The ability to manually upload a signed document when:
- The document was signed physically (wet signature)
- E-sign happened outside the system
- The Nupay download failed but you have the signed PDF

## Current Architecture

The codebase already has `UploadSignedDocumentDialog` component that handles:
- File selection (PDF, JPG, PNG, max 10MB)
- Upload to `loan-documents` bucket
- Update `loan_generated_documents` table with `signed_document_path`
- Mark document as `customer_signed: true`

**Issue**: The dialog currently only supports "Sanction Letter" and "Loan Agreement" as document type options - not "Combined Loan Pack".

## Solution

1. Update `UploadSignedDocumentDialog` to include "Combined Loan Pack" option
2. Add an "Upload Signed" button to the `CombinedLoanPackCard`
3. Pass the dialog trigger from parent `DisbursementDashboard` to `CombinedLoanPackCard`

## Implementation Details

### 1. Update `UploadSignedDocumentDialog.tsx`

Add "Combined Loan Pack" to the document type options:

```typescript
// Line 129-130 - Update docTypeLabel to include combined_loan_pack
const docTypeLabel = documentType === 'sanction_letter' ? 'Sanction Letter' : 
                     documentType === 'loan_agreement' ? 'Loan Agreement' : 
                     documentType === 'combined_loan_pack' ? 'Combined Loan Pack' :
                     documentType === 'daily_schedule' ? 'Daily Repayment Schedule' : '';

// Lines 150-153 - Add SelectItem for combined_loan_pack
<SelectItem value="sanction_letter">Sanction Letter</SelectItem>
<SelectItem value="loan_agreement">Loan Agreement</SelectItem>
<SelectItem value="daily_schedule">Daily Repayment Schedule</SelectItem>
<SelectItem value="combined_loan_pack">Combined Loan Pack</SelectItem>
```

### 2. Update `CombinedLoanPackCard.tsx`

Add props for upload dialog trigger and an "Upload Signed" button:

```typescript
// Add to props interface
onUploadSigned: () => void;

// Add button in CardContent (after E-Sign button, before View Signed)
{isCombinedGenerated && !isCombinedSigned && (
  <Button
    variant="outline"
    onClick={onUploadSigned}
    className="gap-2"
  >
    <Upload className="h-4 w-4" />
    Upload Signed
  </Button>
)}
```

### 3. Update `DisbursementDashboard.tsx`

Pass the upload trigger to CombinedLoanPackCard:

```typescript
// In the CombinedLoanPackCard usage
<CombinedLoanPackCard
  ...existing props...
  onUploadSigned={() => {
    setSelectedDocType("combined_loan_pack");
    setUploadDialogOpen(true);
  }}
/>
```

## Visual Layout After Changes

```text
Combined Loan Pack Card:
┌──────────────────────────────────────────────────────────────────────┐
│ Combined Loan Pack                                    [E-Signed] ✓   │
│ All loan documents in one file for easy signing                      │
├──────────────────────────────────────────────────────────────────────┤
│ [Generated] [Download] [Print] [E-Sign] [Upload Signed] [View Signed]│
│                                                                      │
│ Includes: ✓ Sanction Letter  ✓ Loan Agreement  ✓ Daily Schedule      │
└──────────────────────────────────────────────────────────────────────┘
```

## Button Visibility Logic

| State | Buttons Shown |
|-------|---------------|
| Not generated | Generate (disabled) |
| Generated, not signed | Generate (disabled), Download, Print, E-Sign, **Upload Signed** |
| Signed (via e-sign or upload) | Download, Print, View Signed Document |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/LOS/Sanction/UploadSignedDocumentDialog.tsx` | Add "Combined Loan Pack" and "Daily Repayment Schedule" options |
| `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx` | Add Upload icon import, `onUploadSigned` prop, and upload button |
| `src/components/LOS/Disbursement/DisbursementDashboard.tsx` | Pass `onUploadSigned` handler to CombinedLoanPackCard |

## Technical Notes

- Uses existing upload infrastructure (no new database changes needed)
- Uploads go to `loan-documents` bucket with path: `{orgId}/{applicationId}/signed/combined_loan_pack_{timestamp}.{ext}`
- Updates `loan_generated_documents` table where `document_type = 'combined_loan_pack'`
- After upload, the "View Signed Document" button will appear automatically
