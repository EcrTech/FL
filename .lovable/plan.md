

## Auto-Transition to "Disbursed" Stage After Proof Upload

### Problem
After uploading the disbursement UTR proof, the `loan_disbursements` record is marked as `completed`, but the parent `loan_applications.current_stage` remains at `disbursement_pending`. The application never moves to `disbursed`.

### Fix

**File: `src/components/LOS/Disbursement/ProofUploadDialog.tsx`**

After the disbursement record is updated to `status: "completed"` (around line 163-168), add a follow-up query to update the loan application's stage:

```typescript
// Update loan application stage to "disbursed"
await supabase
  .from("loan_applications")
  .update({
    current_stage: "disbursed",
    updated_at: new Date().toISOString(),
  })
  .eq("id", applicationId);
```

This mirrors the same pattern used in `SanctionGenerator.tsx` (which updates the stage to `disbursement_pending` after creating a sanction).

### Summary
A single addition (~6 lines) in ProofUploadDialog.tsx to transition the loan application to the `disbursed` stage once the UTR proof is uploaded and the disbursement is marked complete. No database migration needed.
