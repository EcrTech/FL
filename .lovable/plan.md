
# Replace OCR-Based Bank Details with Direct Table Data

## Problem
Three files fetch bank details from bank statement OCR data (`loan_documents.ocr_data`) instead of using the verified data stored directly in the `loan_applicants` table. This causes "Bank details not available" errors when no bank statement was uploaded or OCR didn't capture the fields — even though the applicant has verified bank information.

## What Changes

### 1. `src/pages/LOS/Disbursals.tsx`
- Remove the bank statement OCR query (lines 124-133) and `ocrData` variable (line 135)
- Expand the applicant query (line 119) to include: `bank_account_number, bank_ifsc_code, bank_name, bank_account_holder_name`
- Replace `bank_details` construction (lines 153-158) to read directly from the applicant record

### 2. `src/components/LOS/Disbursement/DisbursementForm.tsx`
- Remove the bank statement OCR query (lines 64-79) and `ocrData` variable (lines 97-104)
- Add a query to fetch the primary applicant's bank fields from `loan_applicants`
- Populate `bankDetails` from the applicant record instead of OCR

### 3. `src/components/LOS/Verification/BankAccountVerificationDialog.tsx`
- Remove the bank statement OCR query (lines 44-59)
- Add a query to fetch the primary applicant's bank fields from `loan_applicants`
- Auto-populate the verification form from applicant data instead of OCR data (lines 62-73)

## What Stays the Same
- `DocumentDataVerification.tsx` and `SanctionDetail.tsx` — these use OCR data for **cross-referencing** (comparing document data against application data), which is their intended purpose. No changes needed.
- The OCR parsing edge function — it still parses documents; the data just won't be the primary source for bank details anymore.

## Technical Summary
All three files follow the same pattern:
1. Remove the `loan_documents` OCR query
2. Query `loan_applicants` for `bank_account_number`, `bank_ifsc_code`, `bank_name`, `bank_account_holder_name` (filtered by `applicant_type = 'primary'`)
3. Map those fields to the existing `bankDetails` / `bank_details` object structure
