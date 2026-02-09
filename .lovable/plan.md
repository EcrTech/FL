

## Fix: Set Mandate to "Until Cancelled" to Resolve Date Validation Error

### Root Cause

Nupay's API rejects the mandate because `final_collection_date` equals `first_collection_date`, and "until cancelled" is `false`. The API requires end date > start date unless "until cancelled" is selected.

### Fix

**File: `src/components/LOS/Mandate/CreateMandateDialog.tsx`**

Two changes on the mutation body (around line 147-154):

1. Set `collection_until_cancel` to `true` (instead of `false`)
2. Remove `final_collection_date` from the payload (not needed when "until cancelled" is enabled)

```
// BEFORE:
seq_type: "OOFF",
frequency: "ADHO",
...
first_collection_date: firstCollectionDate,
final_collection_date: firstCollectionDate,
collection_until_cancel: false,

// AFTER:
seq_type: "OOFF",
frequency: "ADHO",
...
first_collection_date: firstCollectionDate,
collection_until_cancel: true,
```

No edge function changes needed -- the edge function already handles the absent `final_collection_date` and passes `colltn_until_cncl` through to Nupay.

| File | Change |
|---|---|
| `src/components/LOS/Mandate/CreateMandateDialog.tsx` | Set `collection_until_cancel: true`, remove `final_collection_date` line |
