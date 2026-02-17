

# Add "View Uploaded Slip" in ProofUploadDialog and DisbursementStatus

## Problem
After uploading the UTR proof, the uploaded document is not visible anywhere in the flow. The confirm step in ProofUploadDialog only shows UTR number and date fields but no preview or link to the uploaded slip. Users have no way to verify what they uploaded.

## Changes

### 1. `src/components/LOS/Disbursement/ProofUploadDialog.tsx`
- In the **confirm step** (step 2), add a "View Uploaded Slip" button using the `Eye` icon from lucide-react
- The button will generate a signed URL from `loan-documents` storage using the `uploadedFilePath` state (already tracked) and open it in a new tab
- Also use the `DocumentPreviewDialog` component (already exists at `src/components/LOS/Verification/DocumentPreviewDialog.tsx`) to show an inline preview when clicked, instead of just opening a new tab -- giving users a richer experience
- Place it between the OCR status indicator and the UTR/date input fields

### 2. `src/components/LOS/Disbursement/DisbursementStatus.tsx`
- The "View Proof" button already exists here (line 184-187) using `ExternalLink` icon -- this part is working
- Add the `Eye` icon alongside the existing `ExternalLink` button for inline preview using `DocumentPreviewDialog`
- This gives users a quick preview without leaving the page

## Technical Details

**ProofUploadDialog.tsx (confirm step):**
- Import `Eye` from lucide-react and `DocumentPreviewDialog` from the verification folder
- Add a `showPreview` state boolean
- Add a clickable row between the OCR indicator and the form fields showing the file name with an Eye icon button
- On click, open `DocumentPreviewDialog` with `file_path: uploadedFilePath`, `file_name: file?.name`

**DisbursementStatus.tsx:**
- Import `Eye` from lucide-react and `DocumentPreviewDialog`
- Add a `showPreview` state boolean
- Add an Eye icon button next to the existing "View Proof" button (or replace ExternalLink with Eye for inline preview)
- On click, open `DocumentPreviewDialog` with `file_path: disbursement.proof_document_path`

