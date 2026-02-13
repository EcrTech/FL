
## Plan: Auto-Verify Bank Statement and Utility Bill Documents After Successful Parsing

### Problem
Bank statements and utility bills currently require manual verification (clicking a checkmark icon) even after successful AI parsing and data extraction. This adds unnecessary manual steps in the workflow and slows down the application processing.

### Solution Overview
Automatically set `verification_status` to `verified` when these document types complete parsing successfully. This will streamline the workflow while maintaining quality since the parsing success itself serves as verification.

### Implementation Approach

#### 1. **Update `parse-loan-document` Edge Function** (Primary Location)
**File:** `supabase/functions/parse-loan-document/index.ts`

**What to Change:** After successful parsing completes and OCR data is merged, automatically update the document's verification status:

- **For bank_statement** and **utility_bill** document types only
- When `parsing_status` transitions to `completed`
- Update `verification_status` from `pending` to `verified`
- Set `verified_at` to current timestamp
- This ensures auto-verification happens at the data layer (backend)

**Location in Code:** Around lines 880-887, after the successful OCR merge and before the success response, add an update query to set these fields.

**Technical Details:**
```
After merging OCR data and syncing to applicant:
- Check if documentType is 'bank_statement' or 'utility_bill'
- Execute: UPDATE loan_documents SET verification_status='verified', verified_at=NOW() WHERE id=documentId
- This is idempotent (safe to retry) and happens atomically with the parse completion
```

#### 2. **Update Frontend UI to Reflect Auto-Verification** (Secondary - UX Clarity)
**File:** `src/components/LOS/DocumentUpload.tsx`

**What to Change:** Hide or disable the manual approval checkmark button for bank statements and utility bills after parsing completes:

- When a document has `parsing_status: 'completed'` AND `document_type` is `bank_statement` or `utility_bill`
- Display a green checkmark or "Verified" badge instead of the approval button
- Remove the ability to click "approve" since it's already verified

**Technical Details:**
- Update the `getVerifyIcon()` function (around lines 584-620) to detect auto-verified documents
- When showing the approval button, exclude `bank_statement` and `utility_bill` types if they have `parsing_status: 'completed'`
- Add a visual indicator (locked/checkmark badge) to show these are auto-verified

#### 3. **Data Consistency Checks**
**No Migration Needed:** Existing parsed documents with `parsing_status: 'completed'` and `verification_status: 'pending'` can be manually verified once in the UI, or you can provide a migration query to bulk-update them if desired. Going forward, new documents will auto-verify on parse completion.

### Key Benefits
- **Reduced Manual Work:** One fewer click per bank statement/utility bill
- **Faster Processing:** Documents are immediately verified upon successful parsing
- **Consistent UX:** Parsing success indicates data quality confidence, so auto-verification is appropriate
- **Safety:** Limited to documents with high-quality OCR (bank statements, utility bills with structured data)

### Design Decisions
- **Why Backend Update:** Doing this in the edge function ensures atomicity—parsing completion and verification happen together in one transaction
- **Why Only Bank/Utility Bills:** These document types have reliable OCR extraction with key fields (account info, bill details). Identity documents (PAN, Aadhaar) are already handled separately via API verification
- **Why Not Auto-Verify Everything:** Income documents (salary slips, ITR, Form 16) have variable structure and may need manual review. Identity documents have dedicated verification APIs.

### Affected User Flows
1. **Upload Bank Statement** → Parse Automatically Triggered → **Auto-Verified** (no manual click)
2. **Upload Utility Bill** → Parse Automatically Triggered → **Auto-Verified** (no manual click)
3. **Manual Parse Retry** on completed documents → Still auto-verifies (idempotent)
4. Existing **idle/failed documents** can still be manually approved via the checkmark (unchanged)

### Testing Checklist
- Bank statement parses successfully → Verify `verification_status` is automatically `verified`
- Utility bill parses successfully → Verify `verification_status` is automatically `verified`
- Other document types (salary slips, rental agreement, etc.) remain `pending` after parsing
- Manual approve button is hidden/disabled for auto-verified bank/utility docs
- No visual change to documents that are manually approved
- Refresh page → verified status persists
- Other document types can still be manually approved

