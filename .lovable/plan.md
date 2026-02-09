

## Autofill Bank Details in eMandate Dialog

### Problem

When opening the "Register eMandate" dialog for the first time (no previous mandate), the bank account fields are empty even though bank details already exist on the application (from verification or manual entry).

### Fix

Pass the application's bank details from `DisbursementDashboard` down to `EMandateSection`, which will then use them as `prefillData` for `CreateMandateDialog` when no previous mandate exists.

### Changes

| File | Change |
|---|---|
| `DisbursementDashboard.tsx` | Pass `bankDetails` as a new prop to `EMandateSection` |
| `EMandateSection.tsx` | Accept new `bankDetails` prop; use it as fallback `prefillData` when there's no existing mandate |

### Technical Details

**1. `EMandateSection.tsx`** - Add optional `bankDetails` prop to the interface:

```typescript
interface EMandateSectionProps {
  // ...existing props
  bankDetails?: {
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
  };
}
```

Update the `prefillData` passed to `CreateMandateDialog`: if there's an existing mandate, use its data (current behavior); otherwise, fall back to the application's bank details:

```typescript
prefillData={mandateData ? {
  bankName: mandateData.bank_name,
  bankAccountNo: mandateData.bank_account_no,
  ifsc: mandateData.ifsc_code,
  accountType: mandateData.account_type,
  accountHolderName: mandateData.account_holder_name,
} : bankDetails ? {
  bankName: bankDetails.bank_name,
  bankAccountNo: bankDetails.account_number,
  ifsc: bankDetails.ifsc_code,
  accountHolderName: borrowerName,
} : undefined}
```

**2. `DisbursementDashboard.tsx`** - Pass the already-fetched `bankDetails` to `EMandateSection`:

```typescript
<EMandateSection
  // ...existing props
  bankDetails={bankDetails}
/>
```

No database changes needed.
