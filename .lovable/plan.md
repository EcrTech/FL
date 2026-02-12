

## Fix: Net Disbursal Showing as 0 in Bulk Payment Report

### Root Cause

The database query returns `loan_sanctions` as a **single object** (one-to-one relationship), not an array. The current code accesses it with `app.loan_sanctions?.[0]`, which returns `undefined` when used on an object. This causes the amount calculation to fall back to 0.

Same issue affects `loan_disbursements` (returned as object/null, not array).

### Changes

**File: `src/components/LOS/Reports/BulkPaymentReport.tsx`** (lines 97-116)

1. Change `app.loan_sanctions?.[0]` to `app.loan_sanctions` (direct object access)
2. Change `app.loan_disbursements?.[0]` to `app.loan_disbursements` (direct object access)
3. Use the pre-calculated `net_disbursement_amount` from the database instead of recalculating, with a fallback calculation for legacy records

Updated mapping logic:
```typescript
const sanction = app.loan_sanctions;  // object, not array
const disbursement = app.loan_disbursements;  // object or null

// Use stored net_disbursement_amount directly
amount: sanction?.net_disbursement_amount || (() => {
  const sanctionedAmt = sanction?.sanctioned_amount || 0;
  const procFee = sanction?.processing_fee || Math.round(sanctionedAmt * 0.10);
  const gst = Math.round(procFee * 0.18);
  return sanctionedAmt - procFee - gst;
})(),
```

### Impact

- Fixes the ₹0 display for all 3 visible records
- Also fixes the exported BLKPAY Excel file (which would contain 0 amounts)
- No database changes needed

