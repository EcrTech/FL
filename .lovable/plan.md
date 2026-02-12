

## Fix: Total Repayment Using Wrong Values + Remove Daily EMI

### Problem

1. **Stale stored values**: The `loan_eligibility` record has `total_interest = 3071.2`, `total_repayment = 22266.2`, `daily_emi = 1392` -- all calculated when the eligible amount was 19,195. Even though `eligible_loan_amount` was corrected to 15,000, these derived values were never updated. The code's "eligibility matches loan" check passes (both 15,000), so it trusts the wrong stored values.

2. **Daily EMI is incorrect terminology**: The loan uses ADHO (bullet) repayment, not daily EMI installments. "Daily EMI" should be removed from all UI surfaces.

### Correct values for this loan
- Principal: Rs 15,000
- Interest: Rs 2,400 (15,000 x 1% x 16 days)
- Total Repayment: Rs 17,400

### Changes

#### 1. Database: Fix stale values in `loan_eligibility`
Update the stored `total_interest`, `total_repayment`, and `daily_emi` for this application to match the corrected Rs 15,000 principal.

#### 2. `src/components/LOS/Disbursement/DisbursementDashboard.tsx`
- **Remove the "Daily EMI" card** from the Loan Summary grid (change from 6-column to 5-column layout)
- **Always recalculate** interest and total repayment from the resolved `loanAmount` instead of trusting stored eligibility values. Remove the `eligibilityMatchesLoan` check entirely -- it's a footgun because derived values can be stale even when the principal matches.
- Remove `dailyEMI` variable and its usage in EMandateSection prop (replace with `totalRepayment` for the ADHO model)

#### 3. `src/components/LOS/Assessment/EligibilityCalculator.tsx`
- Remove the "Daily EMI" card from the Loan Summary section (lines 746-754)
- Change from 4-column to 3-column grid

#### 4. `src/components/LOS/Sanction/SanctionViewer.tsx`
- Remove the "Daily EMI" card from Payment Details
- Keep "Total Repayment" and "Processing Fee"

#### 5. `src/pages/LOS/Sanctions.tsx`
- Remove the "Daily EMI" column from the sanctions table
- Remove `dailyEMI` from email templates (sanction email and approval email)

#### 6. `src/utils/loanCalculations.ts`
- Remove `dailyEMI` from `LoanCalculationResult` interface and `calculateLoanDetails` function

#### 7. `src/hooks/useEMISchedule.ts`
- Remove usage of `dailyEMI` from `calculateLoanDetails` return

#### 8. `src/components/LOS/Disbursement/EMandateSection.tsx`
- Change prop from `dailyEMI` to `totalRepayment` (since mandate collection is ADHO/bullet, the amount is the total repayment, not a daily installment)

#### 9. `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx`
- Remove any Daily EMI display if present

### Impact
- 8-9 files modified
- 1 database update (fix stale derived values)
- No schema changes needed
- All financial calculations will always be derived from principal + rate + tenure at render time, eliminating stale data issues permanently
