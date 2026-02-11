
## Fix: "Failed to approve application" Error

### Root Cause

The user is clicking the **Approve button inside the EligibilityCalculator** (the "Decision" card with green Approve / red Reject buttons), NOT the separate Approval Actions section.

The problem is a **stage mismatch**:

1. When an application reaches `approval_pending` stage, the `AssessmentDashboard` (containing `EligibilityCalculator`) is still visible because the condition at `ApplicationDetail.tsx:970` only hides it for `sanctioned`, `disbursement_pending`, `disbursed`, `closed`.
2. Inside `EligibilityCalculator`, the Decision section shows Approve/Reject buttons when `isFinalized` is false -- but `isFinalized` only checks `status === "approved" || status === "rejected"`. At `approval_pending` stage, status is `in_progress`, so the buttons show.
3. Clicking Approve triggers `transition_loan_stage` with `p_expected_current_stage: "credit_assessment"` -- but the actual stage is `approval_pending`. The optimistic lock correctly rejects this, producing the error.

In short: the EligibilityCalculator's approve buttons are visible and clickable at a stage where they can never succeed.

### Fix

**File: `src/components/LOS/Assessment/EligibilityCalculator.tsx`**

Update the `isFinalized` check (line 115) to also consider the application's `current_stage`. The Decision buttons should be hidden once the application has moved past `credit_assessment`:

```typescript
// Before
const isFinalized = application?.status === "approved" || application?.status === "rejected";

// After
const isFinalized = application?.status === "approved" 
  || application?.status === "rejected"
  || !["assessment", "credit_assessment"].includes(application?.current_stage);
```

This ensures that once the stage moves to `approval_pending` or beyond, the EligibilityCalculator's Decision section shows the read-only "already finalized" card instead of active Approve/Reject buttons. The proper approval flow then happens through the dedicated Approval Actions section that appears at `approval_pending` stage.

### Impact
- Single line change in one file
- No database changes
- No edge function changes
- The separate Approval Actions buttons (at `ApplicationDetail.tsx:978`) remain unaffected and will correctly handle the `approval_pending` to `sanctioned` transition
