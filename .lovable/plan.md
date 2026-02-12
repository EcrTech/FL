
## Root Cause Analysis: Why Stale Values Keep Breaking Disbursals

### The Core Problem

The system stores the same financial data (principal, interest, total repayment) in **three different places** at different stages of the loan lifecycle. When one value is corrected, the others are not updated, causing downstream stages to pick up wrong numbers.

```text
Stage 1: ASSESSMENT
  loan_eligibility table stores:
    - eligible_loan_amount = 19,195 (calculated from FOIR)
    - total_interest = 3,071
    - total_repayment = 22,266
    - daily_emi = 1,392

Stage 2: APPROVAL
  loan_applications table stores:
    - approved_amount = 15,000 (manually reduced by approver)
    BUT: loan_eligibility is NOT updated -- still has 19,195 derived values

Stage 3: SANCTION
  loan_sanctions table stores:
    - sanctioned_amount = 15,000 (copied from approved_amount)
    - sanctioned_rate, sanctioned_tenure_days

Stage 4: DISBURSEMENT
  Code tries to resolve loanAmount via a fallback chain:
    sanction > application > eligibility > requested
  Even when loanAmount resolves correctly to 15,000,
  interest/repayment were previously read from eligibility's STALE values
```

The recent fix (always recalculating at render time in DisbursementDashboard) addressed the symptom for that one component. But the **root cause** remains: the EligibilityCalculator still writes `daily_emi` and derived values based on the eligible amount, and the approval step never syncs these back when a lower amount is approved.

### Why This Keeps Recurring

1. **Approval reduces amount but does not update eligibility derived values** -- The ApprovalActionDialog writes `approved_amount = 15,000` to `loan_applications` but leaves `loan_eligibility.total_interest`, `total_repayment`, and `daily_emi` calculated for 19,195.

2. **Multiple components read from different tables** -- Some read from `loan_eligibility`, some from `loan_sanctions`, some from `loan_applications`. Any mismatch causes wrong displays.

3. **EligibilityCalculator still writes `daily_emi`** -- Even though ADHO has no daily EMI concept, the save mutation still calculates and stores it, which can confuse any component that reads it.

### The Fix: Single Derivation Rule

**Principle**: Never trust stored derived values (interest, repayment, daily_emi). Always recalculate from `(principal, rate, tenure)` at the point of use.

### Changes

#### 1. EligibilityCalculator -- Stop writing `daily_emi`, update derived values on approval

When the "Approve" action is triggered inside EligibilityCalculator, recalculate `total_interest` and `total_repayment` based on the **approved amount** (not the eligible amount) and update the eligibility record accordingly. Remove `daily_emi` calculation entirely.

**File**: `src/components/LOS/Assessment/EligibilityCalculator.tsx`
- In `saveMutation`: Remove `daily_emi` calculation, set it to 0
- In `approveMutation`: After determining `approvedAmount`, update `loan_eligibility` with recalculated `total_interest` and `total_repayment` based on `approvedAmount`

#### 2. ApprovalActionDialog -- Sync eligibility on approval

When the approver confirms with a custom amount, update `loan_eligibility` to reflect the approved principal's derived values.

**File**: `src/components/LOS/Approval/ApprovalActionDialog.tsx`
- After writing `approved_amount` to `loan_applications`, also update `loan_eligibility` with:
  - `eligible_loan_amount = approvedAmount`
  - `total_interest = recalculated`
  - `total_repayment = recalculated`
  - `daily_emi = 0`

#### 3. Sanctions page -- Use `approved_amount` for calculations, not eligibility

**File**: `src/pages/LOS/Sanctions.tsx`
- Already uses `app.approved_amount` for sanction creation -- verified correct
- Ensure email templates use recalculated values, not stored eligibility

#### 4. ApplicationSummary -- Recalculate instead of reading stored values

**File**: `src/components/LOS/ApplicationSummary.tsx`
- If it reads `total_interest` or `total_repayment` from eligibility, switch to recalculating from sanctioned/approved principal

#### 5. Database cleanup -- Fix current stale record

Update the existing stale eligibility record for application `11d0a8cf-472a-4dc1-88ba-50215acb3f64` to set `daily_emi = 0` (it may have been fixed already, but confirm).

### Impact

- 3-4 files modified
- Eliminates the category of bug permanently by ensuring derived values are always recalculated or synced when the principal changes
- No schema changes needed
- `daily_emi` will always be 0 going forward (ADHO model)
