

## Auto-Select Bank and Default to Aadhaar in eMandate Dialog

### Problem

When opening the eMandate dialog, the user must manually search and select a bank even though bank details are already known from the application. The auth type also defaults to empty instead of Aadhaar.

### Fix

**File: `src/components/LOS/Mandate/CreateMandateDialog.tsx`**

1. Default `authType` to `"Aadhaar"` instead of `""` when the dialog opens
2. When `prefillData` includes a bank name, auto-match it against the fetched banks list and pre-select it -- this way the bank step shows the bank already highlighted and auth type set to Aadhaar, so the user can just click "Next"

**File: `src/components/LOS/Mandate/BankSelector.tsx`**

No changes needed -- it already visually highlights `selectedBankId`.

### Technical Details

In `CreateMandateDialog.tsx`:

1. Change the `useEffect` reset logic (line ~188) to set `authType` to `"Aadhaar"` instead of `""`
2. Add another `useEffect` that runs when `banksData` loads: if `prefillData.bankName` exists, find the matching bank in the list (case-insensitive partial match) and call `setSelectedBankId` / `setSelectedBankName`

```typescript
// Default auth type
setAuthType("Aadhaar");

// Auto-select bank from prefill data when banks load
useEffect(() => {
  if (banksData?.banks && prefillData?.bankName && !selectedBankId) {
    const match = banksData.banks.find(b => 
      b.name.toLowerCase().includes(prefillData.bankName.toLowerCase()) ||
      prefillData.bankName.toLowerCase().includes(b.name.toLowerCase())
    );
    if (match) {
      setSelectedBankId(match.bank_id);
      setSelectedBankName(match.name);
    }
  }
}, [banksData, prefillData]);
```

### Changes

| File | Change |
|---|---|
| `CreateMandateDialog.tsx` | Default authType to "Aadhaar"; auto-select bank from prefill data when bank list loads |

No database changes needed.

