
# Fix: Bank Statement Parsing Not Capturing Account Details

## Problem
The bank statement PDF is being parsed, but critical header fields are missing from the extracted data:
- **Account Number** (1947828245) - NOT captured
- **IFSC Code** (KKBK0008083) - NOT captured  
- **Branch Name** (SMVIT BRANCH, BANGALORE) - NOT captured

Only `account_holder_name` (ANUPAM ROY) and `bank_name` (Kotak Mahindra Bank) were captured. Additionally, the AI model is still extracting individual transactions despite explicit instructions not to, wasting tokens and potentially causing truncation of header data.

## Root Cause Analysis

1. **Prompt not strict enough**: The bank statement prompt asks for `account_number`, `ifsc_code`, `branch_name` but the AI model appears to prioritize transaction data over header fields, especially for large PDFs where the first 3 pages contain mostly transactions after the header.

2. **Transactions still being extracted**: Despite the prompt saying "Do NOT include individual transactions", the `ocr_data` in the database contains a massive `transactions` array, confirming the model ignores this instruction.

3. **Chunk prompt dilution**: The first chunk prompt appends "Extract all visible information from these pages" which may override the "no transactions" instruction.

4. **Token budget consumed by transactions**: With 177 pages and transactions being extracted, the 8000 token budget is consumed by transaction data, leaving no room for or pushing out the header metadata.

## Solution

### 1. Strengthen the bank statement prompt (parse-loan-document/index.ts)

Restructure the prompt to:
- Make account details the TOP PRIORITY with explicit emphasis
- List the header fields FIRST with stronger language ("MOST IMPORTANT")
- Add a repeated, stronger prohibition on transactions
- Reduce token limit since we only need summary data (not thousands of transaction rows)

### 2. Add a dedicated first-chunk prompt for bank statements (pdfUtils.ts)

For the first chunk (pages 1-3), use a specialized prompt that focuses ONLY on header/account information:
- Account number, IFSC, branch, account holder name, bank name, account type
- Statement period
- Explicitly state: "These first pages contain the account header. Focus on extracting account identification details."

For subsequent chunks, use a summary-only prompt focusing on balances and totals.

### 3. Fix the chunk prompt override (pdfUtils.ts - getChunkPrompt)

Change the first chunk note from the generic "Extract all visible information" to "Focus on account identification details (account number, IFSC, branch) which are typically on the first page."

### 4. Post-parse cleanup: Strip transactions from stored data (parse-loan-document/index.ts)

Before saving `ocr_data`, explicitly delete the `transactions` array if present:
```
delete mergedData.transactions;
```
This prevents token-heavy transaction data from being stored unnecessarily.

### 5. Reset existing parsed data

Run a database update to clear the current incomplete `ocr_data` and reset `parsing_status` to `idle` for the affected document so the user can re-parse.

---

## Technical Details

### Files to modify:

**supabase/functions/parse-loan-document/index.ts**
- Update `DOCUMENT_PROMPTS.bank_statement` to prioritize header fields with stronger language
- Add transaction stripping before saving to DB (around line 500+)

**supabase/functions/_shared/pdfUtils.ts**  
- Update `getChunkPrompt()` to use bank-statement-specific first-chunk instructions
- Optionally reduce `maxTokens` for bank_statement back to 4000 since we don't need transaction data

### Database fix:
- Reset `parsing_status` to `idle` and clear `ocr_data` for document `5e135623-491d-4c44-bee2-6f83a7d29e6b`

### No UI changes needed
The `BankDetailsSection` component already correctly maps `ocr_data` fields (`account_number` -> `bank_account_number`, `ifsc_code` -> `bank_ifsc_code`, `branch_name` -> `bank_branch`). Once the parsing correctly extracts these fields, auto-fill will work automatically.
