
## Update Amount Column Label to "Net Disbursal"

### What's Happening
The data is already correct -- `net_disbursement_amount` from the database is being used (as confirmed by Anupam Roy's record showing the right value). No fallback logic exists in the current code, so nothing to remove.

The only change needed is a label update in the preview table for clarity.

### Change

**File: `src/components/LOS/Reports/BulkPaymentReport.tsx` (line 216)**

Rename the preview table header from "Amount" to "Net Disbursal":

```
// Before
<TableHead className="text-right">Amount</TableHead>

// After
<TableHead className="text-right">Net Disbursal</TableHead>
```

Single line change. No database or logic modifications needed.
