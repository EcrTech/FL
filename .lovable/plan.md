

## Skip Bank Selection Step When Bank is Auto-Matched

### Problem

Even though we now auto-select the bank and default to Aadhaar, the user still sees the bank selection step and has to click "Next" for no reason. This step adds zero value when everything is already filled.

### Fix

**File: `src/components/LOS/Mandate/CreateMandateDialog.tsx`**

In the existing auto-select `useEffect` (the one that matches `prefillData.bankName` against `banksData`), after successfully setting the bank ID and name, also advance the step directly to `"account"` -- skipping the bank selection screen entirely.

Additionally, update the initial `useEffect` (dialog open reset) so that when `prefillData` is provided with a bank name, we don't hardcode step to `"bank"` -- instead we leave it for the auto-select effect to handle.

### Technical Details

Update the auto-select bank `useEffect` to also skip the step:

```typescript
useEffect(() => {
  if (banksData?.banks && prefillData?.bankName && !selectedBankId) {
    const match = banksData.banks.find((b: any) =>
      b.name.toLowerCase().includes(prefillData.bankName!.toLowerCase()) ||
      prefillData.bankName!.toLowerCase().includes(b.name.toLowerCase())
    );
    if (match) {
      setSelectedBankId(match.bank_id);
      setSelectedBankName(match.name);
      setStep("account"); // Skip bank step entirely
    }
  }
}, [banksData, prefillData, selectedBankId]);
```

The "Back" button on the account step still navigates to the bank step (`setStep("bank")`), so if the user wants to change the bank, they can still go back.

### Changes

| File | Change |
|---|---|
| `CreateMandateDialog.tsx` | Add `setStep("account")` inside the auto-select bank effect when a match is found |

No database changes needed.
