

# Add eMandate Registration to Sanction Detail Page

## Overview
Add an "eMandate Registration" section to the Sanction Detail page that allows users to register eMandate for automated loan collections directly from the application workflow.

## Current State
- eMandate components exist: `CreateMandateDialog.tsx`, `BankSelector.tsx`, `MandateStatusBadge.tsx`
- These are only accessible from Settings → eMandate Settings
- The Sanction Detail page shows: Applicant Details, Loan Summary, Loan Documents
- **No eMandate registration option is available in the loan workflow**

## Proposed Changes

### 1. Add eMandate Section to DisbursementDashboard
Add a new card section after "Loan Documents" in `DisbursementDashboard.tsx`:

```text
┌─────────────────────────────────────────────────────────────┐
│ 📋 eMandate Registration                                    │
│ Set up automated loan repayment collection                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: Not Registered  |  [Register eMandate] button     │
│                                                             │
│  OR (if registered):                                        │
│                                                             │
│  Status: ✓ Active       Mandate ID: ABC123                  │
│  Bank: Punjab National Bank | A/C: ****0100                 │
│  Amount: ₹1,001/day | Frequency: Daily                      │
│  [View Details] [Check Status]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Integration Points
- Import `CreateMandateDialog` into DisbursementDashboard
- Pre-populate mandate form with:
  - **EMI Amount**: Daily EMI from eligibility (`₹1,001`)
  - **Account Holder**: Borrower name
  - **Mobile**: Applicant mobile
  - **Loan No**: Application number
  - **Tenure**: From sanction data (for collection dates)
- Query existing mandates for the application to show status

### 3. New Database Query
Add query to fetch any existing `nupay_mandates` for this application:
```typescript
const { data: mandateData } = useQuery({
  queryKey: ["nupay-mandates", applicationId],
  queryFn: async () => {
    const { data } = await supabase
      .from("nupay_mandates")
      .select("*")
      .eq("loan_application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
});
```

### 4. UI States
| State | Display |
|-------|---------|
| No mandate | "Register eMandate" button |
| Pending | Status badge + "Awaiting customer authentication" |
| Submitted | Status badge + Registration URL/QR |
| Active | Green status badge + Mandate details |
| Failed | Red status badge + Retry option |

---

## Technical Details

### Files to Modify
1. **`src/components/LOS/Disbursement/DisbursementDashboard.tsx`**
   - Import `CreateMandateDialog` and `MandateStatusBadge`
   - Add state for dialog visibility
   - Add query for existing mandates
   - Add eMandate Card section after Loan Documents

### Props to Pass to CreateMandateDialog
```typescript
<CreateMandateDialog
  open={mandateDialogOpen}
  onOpenChange={setMandateDialogOpen}
  applicationId={applicationId}
  orgId={application.org_id}
  borrowerName={borrowerName}
  borrowerMobile={applicant?.mobile}
  dailyEMI={dailyEMI}
  tenure={tenureDays}
  loanNo={application.application_number}
/>
```

### Mandate Status Display
Show mandate status with `MandateStatusBadge` component and relevant details when a mandate exists.

