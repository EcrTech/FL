
## Fix: Standardize Stage Transitions Across the LOS Pipeline

### Root Cause

The stage transitions are inconsistent across components. There is no single, enforced stage pipeline. Different components set conflicting `current_stage` values, causing applications to either skip queues or not appear in the next queue.

### Current (Broken) Flow

```text
EligibilityCalculator (Approve)
  --> current_stage = "approved", status = "approved"
  --> Skips Approval Queue entirely (queue expects status = "in_progress")
  --> Lands directly in Sanctions (which filters status = "approved")

ApprovalActionDialog (Approve)
  --> current_stage = "sanctioned", status = "approved"
  --> Application appears in Sanctions (correct)
  --> But stage "sanctioned" is checked elsewhere for conditional rendering

Sanctions.tsx (Sanction button)
  --> current_stage = "disbursement_pending"
  --> Should appear in Disbursals queue

ProofUploadDialog (UTR Upload)
  --> current_stage = "disbursed"
```

### Correct Stage Pipeline

The intended flow should be:

```text
application_login --> assessment --> approval_pending --> sanctioned --> disbursement_pending --> disbursed
```

### Changes Required

**1. `src/components/LOS/Assessment/EligibilityCalculator.tsx`** (Approve mutation, ~line 409-420)
- Change `current_stage` from `"approved"` to `"approval_pending"`
- Change `status` from `"approved"` to `"in_progress"` (keep it in progress until the approver acts)
- Remove `approved_by` assignment (the approver sets this, not the assessor)
- This ensures the application appears in the Approval Queue

**2. `src/components/LOS/Approval/ApprovalActionDialog.tsx`** (~line 89)
- Keep `current_stage = "sanctioned"` as-is (this correctly moves to Sanctions)
- Keep `status = "approved"` as-is
- This is the correct transition point

**3. `src/pages/LOS/Sanctions.tsx`** (~line 142)
- The sanction mutation already sets `current_stage = "disbursement_pending"` -- this is correct
- No change needed here

**4. `src/pages/LOS/Disbursals.tsx`** (verify only)
- Confirm the Disbursals queue filters include `"disbursement_pending"` -- already correct

### Summary of Stage Value Changes

| Action | current_stage (before fix) | current_stage (after fix) | status (before) | status (after) |
|---|---|---|---|---|
| Assessor Approves | `approved` | `approval_pending` | `approved` | `in_progress` |
| Approver Approves | `sanctioned` | `sanctioned` (no change) | `approved` | `approved` (no change) |
| Sanction Created | `disbursement_pending` | `disbursement_pending` (no change) | -- | -- |
| UTR Uploaded | `disbursed` | `disbursed` (no change) | -- | -- |

### Impact
- Applications will no longer skip the Approval Queue
- Each stage transition feeds correctly into the next queue's filter
- The `approved_by` field will only be set by the actual approver, not the assessor
