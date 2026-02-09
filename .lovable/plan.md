

## Fix: KFS Document Type Mismatch + Historical Compatibility

### Problem

Two issues are blocking loan pack regeneration:

1. **KFS document type mismatch**: The code uses `"key_fact_statement"` but the database only allows `"kfs"`. When the system tries to auto-create missing KFS records for historical applications, the insert fails and the entire "Generate Combined Pack" operation errors out.

2. **Historical applications**: All applications created before the KFS feature was added have no KFS row in `loan_generated_documents`. The auto-creation logic (`ensureIndividualDocs`) already handles this -- it just needs the correct type name to work.

The new Loan Agreement template (with `borrowerEmail`) is already backward-compatible since the prop is optional and defaults gracefully. No separate historical fix is needed for that.

### Fix

**Single file change: `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx`**

Replace all 2 occurrences of `"key_fact_statement"` with `"kfs"`:

- **Line 110**: `generatedDocs.find(d => d.document_type === "key_fact_statement")` changes to `"kfs"`
- **Line 123**: `missingTypes.push("key_fact_statement")` changes to `"kfs"`

### Why This Fixes Both Issues

- The `ensureIndividualDocs` function runs automatically before every pack generation. It checks if each document type (sanction_letter, loan_agreement, daily_schedule, kfs) exists in `loan_generated_documents` for the application. If any are missing, it inserts them.
- With the corrected type name `"kfs"`, this function will successfully create the missing KFS record for any historical application on first regeneration attempt.
- The new Loan Agreement template already handles missing `borrowerEmail` gracefully (optional prop), so historical applications without email data will still render correctly.

### Files Changed

| File | Change |
|---|---|
| `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx` | Replace `"key_fact_statement"` with `"kfs"` on lines 110 and 123 |

No database migration needed. No other file changes.

