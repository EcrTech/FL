
## Fix: Success Prompt Vanishing After ENach Link Generation

### Root Cause

When the mandate is created successfully, the `onSuccess` handler does this in order:
1. Shows a toast
2. **Invalidates the "nupay-mandates" query** (triggers parent refetch)
3. Sets `step` to `"success"` and stores the registration URL

The problem is that step 2 causes `EMandateSection` (the parent) to refetch mandate data. When the refetch completes, `mandateData` is now populated, causing the parent to re-render and show the mandate status card instead of keeping the dialog open. The dialog either gets closed or re-rendered, and the `useEffect` on line 191 resets `step` back to `"bank"` and clears `registrationUrl`.

### Fix

**File: `src/components/LOS/Mandate/CreateMandateDialog.tsx`**

Move the `queryClient.invalidateQueries` call so it only runs **after the dialog is closed**, not immediately on success. This prevents the parent from re-rendering while the success prompt is being displayed.

```
// BEFORE (onSuccess):
toast.success("eMandate registration initiated");
queryClient.invalidateQueries({ queryKey: ["nupay-mandates"] });
if (data.registration_url) {
  setRegistrationUrl(data.registration_url);
  setStep("success");
}

// AFTER (onSuccess):
toast.success("eMandate registration initiated");
if (data.registration_url) {
  setRegistrationUrl(data.registration_url);
  setStep("success");
} else {
  queryClient.invalidateQueries({ queryKey: ["nupay-mandates"] });
  onOpenChange(false);
}
```

Then, move the invalidation to the dialog's close/cleanup logic so it fires when the user dismisses the success screen:

In the `useEffect` that runs when `open` changes (line 191), add the invalidation when the dialog closes:

```
useEffect(() => {
  if (open) {
    // ... existing reset logic
  } else {
    // Refresh mandate data when dialog closes
    queryClient.invalidateQueries({ queryKey: ["nupay-mandates"] });
  }
}, [open, ...]);
```

This ensures:
- The success prompt stays visible with the registration link, QR code, and copy button
- Mandate data is refreshed only when the user closes the dialog
- No race condition between state updates and query invalidation

### Files to Modify

| File | Change |
|---|---|
| `src/components/LOS/Mandate/CreateMandateDialog.tsx` | Move `invalidateQueries` from `onSuccess` to the dialog close cleanup in `useEffect`; keep success step logic unchanged |
