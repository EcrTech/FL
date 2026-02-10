

## Redesign: Self-Chaining Document Fraud Detection with DB-Based Progress

### Overview

Replace the current single-request approach (which times out or crashes on large files) with a **self-chaining edge function** that processes **one document at a time**, saves progress to the database after each step, and triggers itself for the next document. The frontend polls the DB for live progress updates.

### Architecture

The approach mirrors the existing `parse-loan-document` chunked strategy:

1. **Initial call** from the frontend sends `{ applicationId }` -- the edge function identifies all documents, creates a progress record in `loan_verifications`, then processes the **first document only**.
2. After analyzing document #1, it **saves partial results** to `loan_verifications.response_data` and fires a **self-referential fetch** to process document #2.
3. This continues until all documents are done, at which point the final call runs the **cross-document consistency checks**, calculates the overall risk score, and marks the job as `completed`.
4. The frontend **polls** `loan_verifications` every 3 seconds to show live progress (e.g., "Analyzing 4/11...") and renders the result card as soon as the status flips to `completed`.

### Edge Function: `detect-document-fraud/index.ts` (Full Rewrite)

**Input parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `applicationId` | string | Required. The loan application ID |
| `currentIndex` | number | Optional. Which document to analyze (0-based). Omit for initial call. |
| `documentIds` | string[] | Optional. Pre-fetched list of document IDs to process. Set on first call, passed through chain. |
| `accumulatedFindings` | array | Optional. Results from previously analyzed documents. |
| `verificationId` | string | Optional. The `loan_verifications` row ID for progress tracking. |

**Flow per invocation:**

1. If `currentIndex` is undefined (first call):
   - Fetch all `loan_documents` for the application
   - Filter to only documents with `file_path` set
   - Collect all `documentIds` into a list
   - Create/upsert a `loan_verifications` row with status `processing` and `response_data = { status: "processing", total_documents: N, processed: 0, findings: [] }`
   - Set `currentIndex = 0`, proceed to step 2

2. Fetch the document at `documentIds[currentIndex]`
   - Download from storage
   - Use Deno's native `encode` from `std/encoding/base64.ts` (no stack overflow)
   - If file is larger than 5MB, skip with a note but **don't abort** -- record "File too large for visual analysis" and continue
   - Send to Gemini `google/gemini-2.5-flash` for fraud analysis
   - Append result to `accumulatedFindings`

3. Update `loan_verifications.response_data` with current progress:
   ```json
   {
     "status": "processing",
     "total_documents": 11,
     "processed": 4,
     "current_document": "salary_slip_2",
     "findings": [/* results so far */]
   }
   ```

4. If `currentIndex + 1 < documentIds.length`:
   - Fire self-referential `fetch()` (fire-and-forget) with `currentIndex + 1`
   - Return `200` with `{ status: "processing" }` immediately

5. If all documents done (final invocation):
   - Run cross-document consistency checks using OCR data
   - Calculate overall risk score
   - Update `loan_verifications` with final result:
     ```json
     {
       "status": "completed",
       "overall_risk": "medium",
       "risk_score": 45,
       "documents_analyzed": 11,
       "findings": [...],
       "cross_document_checks": [...],
       "analyzed_at": "..."
     }
     ```
   - Set `loan_verifications.status` to `"success"` / `"warning"` / `"failed"` based on risk

### Frontend Changes: `DocumentUpload.tsx`

**Button behavior:**
- On click: invoke `detect-document-fraud` with just `{ applicationId }`
- Set `isRunningFraudCheck = true`
- Start a **polling interval** (every 3 seconds) that queries `loan_verifications` for `verification_type = 'document_fraud_check'`
- Display progress from `response_data`: "Analyzing 4/11 (salary_slip_2)..."
- When `response_data.status === "completed"`, stop polling, show toast, invalidate queries, set `isRunningFraudCheck = false`
- Add a timeout safety net (5 minutes) -- if still processing after that, stop polling and show an error

**FraudCheckResultCard:** No changes needed -- it already handles the final result shape.

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/detect-document-fraud/index.ts` | Full rewrite with self-chaining |
| `src/components/LOS/DocumentUpload.tsx` | Add polling logic and progress display |

### Technical Details

- **Base64 encoding**: Uses `import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"` -- completely stack-safe
- **No document skipped**: Large files get a "too large" note but are still recorded in findings
- **Rate limit handling**: If Gemini returns 429, the function waits 2 seconds and retries once. If still failing, records "Rate limited" and continues to next document.
- **Error resilience**: Each document is wrapped in try/catch. A failure on one document does not abort the chain.
- **Self-invocation uses `SUPABASE_SERVICE_ROLE_KEY`** in the Authorization header (same pattern as `parse-loan-document`)
- **No schema changes needed** -- uses existing `loan_verifications` columns (`response_data` JSONB stores progress and results)

