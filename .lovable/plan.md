

## Fix: Bulk Payment Report Showing No Records

### Root Cause
The query in `BulkPaymentReport.tsx` filters on `.eq("loan_applicants.is_primary", true)` (line 70), but the `loan_applicants` table has no `is_primary` column. The correct column is `applicant_type` with the value `"primary"`.

Because the join uses `!inner`, this mismatch causes **all rows to be filtered out**, which is why the report is completely empty -- not just missing Anupam Roy.

### Fix

**File: `src/components/LOS/Reports/BulkPaymentReport.tsx` (line 70)**

Change:
```typescript
.eq("loan_applicants.is_primary", true)
```
To:
```typescript
.eq("loan_applicants.applicant_type", "primary")
```

Single line change. No database modifications needed.

