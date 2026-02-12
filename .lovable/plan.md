

## Simplify Bank Statement Parsing: Extract Only Account Details

### What Changes

Instead of sending the entire bank statement PDF to AI for full analysis (account details + statement period + balances + AI financial insights), the parser will only extract the basic bank account identification details from the first page.

### Why

- Faster processing -- smaller, focused prompt means quicker AI response
- Lower cost -- fewer tokens consumed
- More reliable -- less data to parse means fewer failures
- The full analysis (balances, spending patterns, recommendations) is handled separately through the Verification Dashboard's "Bank Statement Analysis" feature anyway

### Changes

**File: `supabase/functions/parse-loan-document/index.ts`**

Update the `bank_statement` prompt to only extract account identification fields:

```
Current prompt extracts:
- Account details (number, IFSC, bank name, branch, holder name, type)
- Statement period (from/to dates)
- Summary figures (opening/closing balance, credits, debits, avg balance)
- AI analysis (insights array, recommendation)

New prompt will extract ONLY:
- account_number
- ifsc_code
- branch_name
- account_holder_name
- bank_name
- account_type
```

This keeps the same data fields that `BankDetailsSection.tsx` consumes (account_number, ifsc_code, bank_name, branch_name, account_holder_name) while removing the heavy analysis that causes timeouts and failures.

### Technical Details

1. **Simplified prompt** -- Replace the 20+ line bank_statement prompt with a focused 8-line prompt asking only for account identification fields
2. **Remove transaction stripping logic** -- The two blocks that strip `mergedData.transactions` for bank_statement type (lines 550-552 and 608-611) become unnecessary but are harmless to keep as safety checks
3. **Fix PDF format** -- Also fix the `type: "image_url"` back to `type: "file"` format which is required for PDFs (root cause of current parsing failures)
4. **No frontend changes needed** -- `BankDetailsSection.tsx` already reads only account fields from `ocr_data`

