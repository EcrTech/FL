
# Add Manual Entry Fallback Where OCR Is the Only Data Source

## Problem
Several components rely solely on OCR-extracted data with no way for users to manually enter or correct information when OCR fails, documents are unclear, or data was entered manually in the first place.

## Areas Identified

### 1. ProofUploadDialog (UTR Proof Upload) -- Needs Manual Entry
**File:** `src/components/LOS/Disbursement/ProofUploadDialog.tsx`

Currently, after uploading UTR proof, the system attempts OCR extraction of the UTR number and transaction date. If OCR fails, the disbursement is silently completed with no UTR number recorded.

**Fix:** Add a two-step flow:
- **Step 1 (Upload):** User uploads the proof file, OCR runs in the background
- **Step 2 (Confirm/Edit):** Show extracted UTR number and date in editable input fields. If OCR failed or returned empty, the fields are blank for manual entry. UTR number is required before completing the disbursement.
- Add state variables: `step` ("upload" | "confirm"), `utrNumber`, `disbursementDate`, `isExtracting`
- Split the mutation: first mutation handles upload and OCR, second mutation saves the final confirmed/edited values and transitions the loan stage

### 2. IncomeSummary (Salary Slip Data) -- Needs Manual Entry
**File:** `src/components/LOS/IncomeSummary.tsx`

Currently shows salary slip data ONLY from OCR-parsed documents. If salary slips weren't uploaded or OCR failed, the component shows "No income data available" with no way to enter data manually.

**Fix:** Add a manual salary entry form:
- Add an "Add Salary Slip Manually" button that opens inline editable rows
- Allow users to enter month, gross salary, net salary, basic, HRA, PF, TDS, and other deductions
- Same for annual income (Form 16/ITR): add manual entry for assessment year, gross income, taxable income, and tax paid
- Manual entries get merged with OCR-extracted data in the same table
- Store manual entries in the `loan_income_summaries` table's `salary_slip_details` field (already exists as JSON)

### 3. BankDetailsSection -- Remove Unnecessary OCR Query
**File:** `src/components/LOS/BankDetailsSection.tsx`

This component already has manual editing capability, but it still queries `loan_documents` for bank statement OCR data as a fallback when applicant data is empty.

**Fix:** Remove the `bankStatementDoc` OCR query (lines 67-81) and the OCR fallback in the useEffect (lines 100-114). The applicant record in `loan_applicants` is the source of truth. If no bank data exists on the applicant, the form should simply start empty and allow manual entry (which it already supports via the edit mode).

## What Stays the Same

- **EligibilityCalculator** -- Already has editable form fields; OCR just auto-populates them. Manual entry already works.
- **DocumentDataVerification** -- Intentionally cross-references OCR data against application data. This is its purpose.
- **ApplicationDetail** -- Uses OCR for display enrichment alongside applicant table data.

## Technical Summary

| Component | Current State | Change |
|-----------|--------------|--------|
| ProofUploadDialog | OCR-only, silent failure | Two-step flow with editable UTR/date fields |
| IncomeSummary | OCR-only, no fallback | Add manual salary/income entry rows |
| BankDetailsSection | OCR fallback + manual edit | Remove OCR query, keep manual edit |
| EligibilityCalculator | OCR auto-fill + editable fields | No change needed |
| DocumentDataVerification | Cross-reference tool | No change needed |
