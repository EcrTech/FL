

## Merge Bank Auto-Select into Reset Effect

### Problem
Two competing `useEffect` hooks cause a race condition. The reset effect always sets `step = "bank"`, and the separate auto-select effect never re-fires because its dependency (`selectedBankId`) doesn't actually change (it was already `null`).

### Fix

**File: `src/components/LOS/Mandate/CreateMandateDialog.tsx`**

1. Move the bank-matching logic into the existing reset `useEffect` (lines 185-212), right after resetting state. If a match is found, set the bank ID/name and set step to `"account"` instead of `"bank"`.
2. Delete the separate auto-select `useEffect` (lines 214-227) entirely.
3. Add `banksData` to the reset effect's dependency array.

### Technical Details

The reset effect becomes:

```typescript
useEffect(() => {
  if (open) {
    setSelectedBankId(null);
    setSelectedBankName("");
    setAuthType("Aadhaar");

    // Auto-match bank from prefill data
    let autoMatchedBank = false;
    if (banksData?.banks && prefillData?.bankName) {
      const match = banksData.banks.find((b: any) =>
        b.name.toLowerCase().includes(prefillData.bankName!.toLowerCase()) ||
        prefillData.bankName!.toLowerCase().includes(b.name.toLowerCase())
      );
      if (match) {
        setSelectedBankId(match.bank_id);
        setSelectedBankName(match.name);
        autoMatchedBank = true;
      }
    }

    setStep(autoMatchedBank ? "account" : "bank");

    // Prefill account fields (unchanged)
    if (prefillData) {
      setAccountHolderName(prefillData.accountHolderName || applicantName);
      // ... rest unchanged
    } else {
      // ... rest unchanged
    }
    // ... rest unchanged
  }
}, [open, applicantName, loanAmount, tenure, prefillData, banksData]);
```

Delete lines 214-227 (the separate auto-select `useEffect`).

### Changes

| File | Change |
|---|---|
| `CreateMandateDialog.tsx` | Merge bank matching into reset effect; remove separate auto-select hook; add `banksData` to deps |

No database changes needed.
