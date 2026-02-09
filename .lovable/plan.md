

## Fix: Remove Non-Existent Column from SELECT

### Root Cause
The previous fix corrected the `.eq()` filter to use `applicant_type`, but the `select()` statement on line 59 still includes `is_primary` -- a column that does not exist in the `loan_applicants` table. This causes the query to error out silently, returning no records.

### Fix

**File: `src/components/LOS/Reports/BulkPaymentReport.tsx` (line 59)**

Remove `is_primary` from the select clause (or replace it with `applicant_type` if needed elsewhere):

```typescript
// Line 59 - Change:
is_primary

// To:
applicant_type
```

Single line change. No database modifications needed.

