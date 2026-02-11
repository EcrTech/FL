

## Simplify Bank Statement Parsing

### Problem
Bank statements currently use a complex page-by-page chunked parsing strategy that is slow, prone to timeouts, and often fails to extract summary data (like total_credits/debits). Meanwhile, credit reports use a much simpler single-shot approach that sends the entire PDF to Gemini and gets back a clean summary -- and it works reliably.

### Solution
Switch bank statement parsing to a single-shot approach identical to how credit reports work:
1. Send the entire PDF to Gemini in one call
2. Extract only account identification details and a brief AI-generated analysis summary
3. No chunking, no self-referential continuation calls
4. Store the uploaded document for viewing and display the AI summary alongside it

### Technical Changes

**File: `supabase/functions/parse-loan-document/index.ts`**
- Remove `bank_statement` from the `CHUNKABLE_DOC_TYPES` array (line 212)
- Update the `bank_statement` prompt to be concise: extract account details (account number, IFSC, holder name, bank name, type) plus ask for a brief analytical summary (spending patterns, salary regularity, bounce flags, average balance assessment)
- Add an `analysis_summary` field to the prompt output requesting 3-5 key observations
- Since it will no longer chunk, the existing single-shot PDF path already handles it

**Prompt update (bank_statement):**
- Keep: account_number, ifsc_code, branch_name, account_holder_name, bank_name, account_type, statement_period_from/to
- Keep: opening_balance, closing_balance, total_credits, total_debits, average_monthly_balance
- Add: `analysis_summary` -- an array of 3-5 key insights (salary pattern, spending behavior, bounce count, EMI regularity, risk flags)
- Add: `recommendation` -- a 1-2 sentence overall assessment
- Remove the "ABSOLUTE PROHIBITION" language about transactions (no longer needed since we are not chunking)

**No frontend changes required** -- the existing document display and OCR data views will automatically show the new fields. The bank details auto-population logic already reads from `ocr_data` and will continue to work.

### Benefits
- Faster: single API call instead of multiple chunked calls
- More reliable: no self-referential fetch chains that can fail mid-way
- Richer output: AI provides analytical insights, not just raw extracted numbers
- Consistent: same pattern as credit report analysis

