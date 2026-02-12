

## Fix: Full Name Not Showing in Pipeline

### Problem
When a returning user submits the referral form with a full name (e.g., "Amit Kumar"), the pipeline only shows "Amit" because:

1. The contact record was originally created with only "Amit" (no last name provided at that time)
2. On subsequent submissions, the edge function finds the existing contact by phone number but **only updates the status** -- it does not update the name fields

### Solution
Update the `create-early-lead` edge function to also update `first_name` and `last_name` when an existing contact is found. This ensures the latest name entered by the user is always reflected.

### Technical Details

**File**: `supabase/functions/create-early-lead/index.ts`

Change the existing contact update block (lines 96-99) from:
```typescript
.update({ status: 'new' })
```
to:
```typescript
.update({
  status: 'new',
  first_name: firstName,
  last_name: lastName || null,
})
```

This is a one-line change in one file. After deploying, the next time a user submits Step 1, the contact's name will be fully updated.

**After the fix**, you'll need to delete the current test record and re-test to see the full name appear correctly.
