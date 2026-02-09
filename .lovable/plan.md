

## Fix: Interest Amount Using Stale Eligibility Data

### Root Cause

The "Interest Amount" on the Loan Summary card shows Rs. 3,243 instead of Rs. 1,800. Here's why:

- The **eligibility assessment** calculated interest on the **eligible amount of Rs. 21,621** (21,621 x 1% x 15 days = Rs. 3,243)
- The loan was later **sanctioned/approved at Rs. 12,000** (a lower amount)
- The dashboard pulls `total_interest` from the eligibility record as the "single source of truth," but that value belongs to the original eligible amount, not the actual sanctioned amount
- Correct interest: 12,000 x 1% x 15 = **Rs. 1,800**

The same issue affects **Total Repayment** and **Daily EMI** — all three are sourced from eligibility but calculated against a different principal.

### Fix

**File: `src/components/LOS/Disbursement/DisbursementDashboard.tsx`** (lines 305-316)

Change the logic so that stored eligibility values are only used when the loan amount matches the eligibility amount. Otherwise, recalculate based on the actual sanctioned/approved amount.

```
// BEFORE (lines 306-316):
const loanAmount = sanction?.sanctioned_amount || ...;
...
const interestAmount = eligibility?.total_interest ?? Math.round(calculatedInterest * 100) / 100;
const totalRepayment = eligibility?.total_repayment ?? Math.round(calculatedRepayment * 100) / 100;
const dailyEMI = eligibility?.daily_emi ?? Math.round(calculatedRepayment / tenureDays);

// AFTER:
const loanAmount = sanction?.sanctioned_amount || application.approved_amount || eligibility?.eligible_loan_amount || application.requested_amount || 0;
const interestRate = sanction?.sanctioned_rate || application.interest_rate || eligibility?.recommended_interest_rate || 0;
const tenureDays = sanction?.sanctioned_tenure_days || application.tenure_days || eligibility?.recommended_tenure_days || 30;

// Only use stored eligibility values if the loan amount matches what eligibility was calculated on
const eligibilityMatchesLoan = eligibility && Number(eligibility.eligible_loan_amount) === loanAmount;

const calculatedInterest = loanAmount * (interestRate / 100) * tenureDays;
const calculatedRepayment = loanAmount + calculatedInterest;

const interestAmount = eligibilityMatchesLoan ? (eligibility.total_interest ?? Math.round(calculatedInterest * 100) / 100) : Math.round(calculatedInterest * 100) / 100;
const totalRepayment = eligibilityMatchesLoan ? (eligibility.total_repayment ?? Math.round(calculatedRepayment * 100) / 100) : Math.round(calculatedRepayment * 100) / 100;
const dailyEMI = eligibilityMatchesLoan ? (eligibility.daily_emi ?? Math.round(calculatedRepayment / tenureDays)) : Math.round(calculatedRepayment / tenureDays);
```

This ensures:
- When the sanctioned amount equals the eligible amount, stored values are used (single source of truth)
- When they differ (as in this case), values are recalculated correctly from the actual loan amount
- No other files need changes — the document templates already receive these computed values as props

### Expected Result

| Metric | Before (wrong) | After (correct) |
|---|---|---|
| Interest Amount | Rs. 3,243 | Rs. 1,800 |
| Total Repayment | Rs. 24,864 | Rs. 13,800 |
| Daily EMI | Rs. 1,658 | Rs. 920 |

### Files to Modify

| File | Change |
|---|---|
| `src/components/LOS/Disbursement/DisbursementDashboard.tsx` | Add eligibility-match check; use recalculated values when sanctioned amount differs from eligible amount |

