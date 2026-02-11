
## Fix: Application Stuck at `application_login` Stage

### Problem

Application LOAN-202602-00393 (Hemant Chauhan) is stuck at the `application_login` stage. The "Decision" section shows "Application has already been IN_PROGRESS" because our recent fix correctly hides the Approve/Reject buttons when the stage isn't `assessment` or `credit_assessment`.

The real issue: **there is no mechanism to advance an application from `application_login` to the assessment stages**. The pipeline expects this flow:

```text
application_login --> assessment --> credit_assessment --> approval_pending --> sanctioned
```

But only the later transitions (credit_assessment onwards) have UI buttons. The early transitions have no trigger -- neither manual nor automatic.

### Solution

Add a **"Start Assessment"** button on the Application Detail page that advances the application directly from `application_login` to `credit_assessment`, skipping the intermediate stages (`document_collection`, `field_verification`, `assessment`) that don't have dedicated workflows. This is consistent with how the system actually works -- staff log in the application, upload documents/run verifications on the same page, then assess eligibility.

### Changes

**File: `src/pages/LOS/ApplicationDetail.tsx`**

1. Add a "Start Assessment" button that appears when the application is at the `application_login` stage
2. The button calls `transition_loan_stage` RPC to move the application from `application_login` to `credit_assessment`
3. After transition, the EligibilityCalculator's Approve/Reject buttons will become active (since the stage will be `credit_assessment`)

The button will:
- Be placed prominently near the Assessment Dashboard section
- Use `transition_loan_stage` with `p_expected_current_stage: "application_login"` and `p_new_stage: "credit_assessment"`
- Invalidate query cache on success so the page refreshes with the new stage
- Include a confirmation step to prevent accidental clicks

### Technical Details

```typescript
// New mutation in ApplicationDetail.tsx
const startAssessmentMutation = useMutation({
  mutationFn: async () => {
    const { data, error } = await supabase.rpc("transition_loan_stage", {
      p_application_id: application.id,
      p_expected_current_stage: "application_login",
      p_new_stage: "credit_assessment",
      p_new_status: "in_progress",
    });
    if (error) throw error;
    if (!data) throw new Error("Stage has changed. Please refresh.");
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["loan-application"] });
    toast({ title: "Application moved to Credit Assessment" });
  },
});
```

The button will render conditionally:
```tsx
{application.current_stage === "application_login" && (
  <Card>
    <CardContent className="pt-6">
      <Button onClick={() => startAssessmentMutation.mutate()}>
        Start Assessment
      </Button>
    </CardContent>
  </Card>
)}
```

### What Happens After

Once the application is at `credit_assessment`:
1. The EligibilityCalculator will show active Approve/Reject buttons
2. Clicking Approve moves it to `approval_pending`
3. The Approval Actions card then appears for final approval to `sanctioned`

### Impact
- One file modified: `src/pages/LOS/ApplicationDetail.tsx`
- No database changes needed (the `transition_loan_stage` function already supports any stage-to-stage transition)
- No edge function changes
