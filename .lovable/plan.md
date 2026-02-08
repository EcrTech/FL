

## Fix: Replace Hardcoded Financial Values with Dynamic Variables

### Problem Found

Two financial values in the Combined Loan Pack documents are **hardcoded as static numbers** instead of being sourced from organization settings:

| Value | Current | Should Be |
|---|---|---|
| Bounce/Return Charges | Hardcoded `500` | From `organization_loan_settings` |
| Penal Interest Rate | Hardcoded `24` (% p.a.) | From `organization_loan_settings` |

These appear in 3 places:
- `DisbursementDashboard.tsx` lines 539, 540
- `CombinedLoanPackCard.tsx` lines 435, 436
- `CombinedLoanDocuments.tsx` lines 119-122 (fallback defaults)

### Plan

#### Step 1: Add columns to `organization_loan_settings` table

Add two new columns via database migration:
- `bounce_charges` (integer, default 500)
- `penal_interest_rate` (numeric, default 24)

#### Step 2: Update `DisbursementDashboard.tsx`

Replace the hardcoded values:
```
// Before
bounceCharges={500}
penalInterest={24}

// After
bounceCharges={orgSettings?.bounce_charges || 500}
penalInterest={orgSettings?.penal_interest_rate || 24}
```

Apply to both the standalone `LoanAgreementDocument` (line 539-540) and the `CombinedLoanPackCard` props.

#### Step 3: Update `CombinedLoanPackCard.tsx`

- Add `bounceCharges` and `penalInterest` to the component's props interface (sourced from `orgSettings` in the parent).
- Pass them through to `CombinedLoanDocuments` instead of hardcoded values.

Alternatively (simpler): pass `orgSettings` to `CombinedLoanPackCard` already (it's already a prop), and have `CombinedLoanPackCard` read `orgSettings.bounce_charges` and `orgSettings.penal_interest_rate` when passing to `CombinedLoanDocuments`.

#### Step 4: Update `CombinedLoanDocuments.tsx` and its sub-documents

- Add `bounceCharges` and `penalInterest` to the `CombinedLoanDocumentsProps` interface.
- Pass them to `LoanAgreementDocument` and `KeyFactStatementDocument` instead of the current hardcoded fallback of `500` and `24`.

### Files Changed

| File | Change |
|---|---|
| Database migration | Add `bounce_charges` and `penal_interest_rate` columns to `organization_loan_settings` |
| `src/components/LOS/Disbursement/DisbursementDashboard.tsx` | Use `orgSettings` values instead of `500` and `24` |
| `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx` | Add props for bounce charges and penal interest; pass to template |
| `src/components/LOS/Sanction/templates/CombinedLoanDocuments.tsx` | Add props, pass through to sub-documents |

### Note on Anupam Roy's Data

Anupam Roy's processing fee is stored as `0` in `loan_sanctions`. This means the sanction was created before the 10% processing fee logic was implemented. The current code correctly falls back to calculating `Math.round(loanAmount * 0.10) = 900` when `sanction.processing_fee` is falsy. So his documents should show the correct ₹900 processing fee. If his sanction record needs correction, that's a separate data fix.

Include changes across timeline for all past and future calculations and document production. 