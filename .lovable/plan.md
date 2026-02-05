
# Plan: Add Option for Reinitiating NACH/eMandate

## Overview
Currently, the eMandate registration can only be reinitiated when the mandate status is `rejected` or `expired`. This enhancement will add a "Reinitiate NACH" button that allows staff to create a new mandate even when a previous one is in `submitted` or `cancelled` status, with the option to prefill bank details from the previous attempt.

## Current Behavior
- **No Mandate**: "Register eMandate" button shown
- **Rejected/Expired**: "Register New Mandate" button shown
- **Submitted/Pending**: Only "Check Status" button available (no reinitiation)
- **Active/Accepted**: No action buttons (mandate is working)
- **Cancelled**: No reinitiation option currently

## Proposed Changes

### 1. Update EMandateSection.tsx - Button Logic
Expand the reinitiation conditions to include `submitted`, `cancelled`, and `pending` statuses. Add a confirmation dialog for cases where an existing mandate might be replaced.

**Changes:**
- Add state for confirmation dialog (`showReinitiateConfirm`)
- Modify button visibility logic to show "Reinitiate NACH" for more statuses
- Pass previous mandate data to the dialog for prefilling
- Show warning when reinitiating over an existing submitted/pending mandate

### 2. Update CreateMandateDialog.tsx - Prefill Support
Add optional prop to receive previous mandate data and prefill the form fields.

**Changes:**
- Add new prop: `prefillData?: { bankName, bankAccountNo, ifsc, accountType, accountHolderName }`
- Update `useEffect` to populate form fields from prefillData when provided
- Fields will still be editable (prefill is convenience, not locked)

### 3. Add Confirmation Dialog
When reinitiating over a `submitted` or `pending` mandate, show a warning that the previous registration link will become invalid.

## User Experience Flow

```text
+------------------+     +-------------------+     +------------------+
| EMandateSection  | --> | Confirm Dialog    | --> | CreateMandate    |
| [Reinitiate]     |     | (if submitted/    |     | Dialog           |
|                  |     |  pending)         |     | [Prefilled]      |
+------------------+     +-------------------+     +------------------+
```

## Technical Details

### EMandateSection.tsx Changes

**New State:**
```typescript
const [showReinitiateConfirm, setShowReinitiateConfirm] = useState(false);
```

**Updated Button Logic (Line 247-256):**
```typescript
{/* Show reinitiate for rejected, expired, cancelled, submitted, pending */}
{getMandateStatus() !== "accepted" && mandateData && (
  <Button 
    variant="outline" 
    size="sm"
    onClick={() => {
      // Show confirmation for submitted/pending (link will be invalidated)
      if (getMandateStatus() === "submitted" || getMandateStatus() === "pending") {
        setShowReinitiateConfirm(true);
      } else {
        setMandateDialogOpen(true);
      }
    }}
  >
    <CreditCard className="h-4 w-4 mr-2" />
    Reinitiate NACH
  </Button>
)}
```

**Add ConfirmDialog:**
```typescript
<ConfirmDialog
  open={showReinitiateConfirm}
  onOpenChange={setShowReinitiateConfirm}
  title="Reinitiate eMandate?"
  description="The previous registration link will become invalid. The customer will need to complete authentication again with the new link."
  onConfirm={() => {
    setShowReinitiateConfirm(false);
    setMandateDialogOpen(true);
  }}
  confirmText="Reinitiate"
  variant="default"
/>
```

**Pass Prefill Data to Dialog:**
```typescript
<CreateMandateDialog
  // ... existing props
  prefillData={mandateData ? {
    bankName: mandateData.bank_name,
    bankAccountNo: mandateData.bank_account_no,
    ifsc: mandateData.ifsc_code,
    accountType: mandateData.account_type,
    accountHolderName: mandateData.account_holder_name,
  } : undefined}
/>
```

### CreateMandateDialog.tsx Changes

**New Interface Prop:**
```typescript
interface CreateMandateDialogProps {
  // ... existing props
  prefillData?: {
    bankName?: string;
    bankAccountNo?: string;
    ifsc?: string;
    accountType?: string;
    accountHolderName?: string;
  };
}
```

**Updated useEffect (Line 178-199):**
```typescript
useEffect(() => {
  if (open) {
    setStep("bank");
    // Prefill from previous mandate if provided
    if (prefillData) {
      setAccountHolderName(prefillData.accountHolderName || applicantName);
      setBankAccountNo(prefillData.bankAccountNo || "");
      setBankAccountNoConfirm(prefillData.bankAccountNo || "");
      setIfscCode(prefillData.ifsc || "");
      setAccountType((prefillData.accountType as "Savings" | "Current") || "Savings");
    } else {
      setAccountHolderName(applicantName);
      setBankAccountNo("");
      setBankAccountNoConfirm("");
      setIfscCode("");
      setAccountType("Savings");
    }
    // Reset other fields
    setSelectedBankId(null);
    setSelectedBankName("");
    setAuthType("");
    // ... rest of resets
  }
}, [open, applicantName, emiAmount, prefillData]);
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/LOS/Disbursement/EMandateSection.tsx` | Add reinitiate button logic, confirmation dialog, pass prefill data |
| `src/components/LOS/Mandate/CreateMandateDialog.tsx` | Add prefillData prop, prefill form fields on open |

## Edge Cases Handled

1. **Submitted Mandate**: Warning shown that previous link will be invalidated
2. **Pending Mandate**: Same as submitted - confirmation required
3. **Rejected/Expired/Cancelled**: Direct reinitiation allowed (no active link)
4. **Active Mandate**: Reinitiate button hidden (mandate is working)
5. **No Mandate**: Original "Register eMandate" button shown

## Benefits

- Staff can reinitiate without waiting for expiry when customer has issues
- Prefilled bank details reduce data entry errors
- Confirmation prevents accidental invalidation of working registration links
- Clean UX with appropriate warnings
