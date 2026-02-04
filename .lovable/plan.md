
# Implementation Plan: Page-by-Page PDF Parsing with Self-Chaining

## Executive Summary
This plan addresses the issue of incomplete document parsing for large PDFs (bank statements, CIBIL reports, etc.) by implementing a chunked parsing approach with self-chaining to avoid timeouts and payload limits. The solution will process documents page-by-page, accumulating results in the database, and chain function invocations to handle documents of any length.

---

## Problem Analysis

### Current Issues
1. **Payload Size Limits**: Base64 encoding increases file size by ~33%, often exceeding the ~10MB request limit
2. **Memory Constraints**: Edge functions have ~256MB memory; large PDFs can exhaust this
3. **Execution Timeouts**: 60-second limit causes failures on 20+ page documents
4. **Token Output Limits**: AI responses capped at 2,000-4,000 tokens, insufficient for detailed extraction
5. **Base64 Bug in CIBIL**: The `parse-cibil-report` function uses spread operator which causes stack overflow on large files

### Affected Edge Functions
| Function | Document Types | Current Issues |
|----------|---------------|----------------|
| `parse-loan-document` | Bank Statements, ITR, Form 16, Salary Slips | Token limit (4,000), timeout on large PDFs |
| `parse-cibil-report` | CIBIL, Experian, Equifax reports | Stack overflow on Base64, token limit (2,048) |

---

## Solution Architecture

### High-Level Flow

```text
+----------------+     +-------------------+     +------------------+
|   Frontend     |     |   Edge Function   |     |    Database      |
|   Component    |     |   (Chunked)       |     |  loan_documents  |
+-------+--------+     +--------+----------+     +--------+---------+
        |                       |                         |
        | 1. Invoke parse       |                         |
        |---------------------->|                         |
        |                       | 2. Download PDF         |
        |                       | 3. Count pages (pdf-lib)|
        |                       | 4. Extract chunk 1-5    |
        |                       |------------------------>|
        |                       | 5. Save partial results |
        |                       |                         |
        |                       | 6. Self-invoke (async)  |
        |                       |    for pages 6-10       |
        |                       |<------------------------|
        |                       |                         |
        | 7. Return immediately |                         |
        |<----------------------|                         |
        |                       |                         |
        |   [Background continues...]                     |
        |                       |                         |
```

### Key Design Decisions

1. **Chunk Size**: 5 pages per chunk (balances payload size vs. number of invocations)
2. **State Storage**: Use `ocr_data` JSONB column to accumulate partial results
3. **Progress Tracking**: Add `parsing_status` and `parsing_progress` fields
4. **Self-Chaining**: Non-blocking `fetch()` call (fire-and-forget pattern from `send-bulk-email`)
5. **Idempotency**: Track `current_page` to prevent duplicate processing

---

## Technical Implementation

### Phase 1: Database Schema Updates

**New columns for `loan_documents` table:**

```sql
-- Add parsing progress tracking columns
ALTER TABLE loan_documents 
ADD COLUMN IF NOT EXISTS parsing_status TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS parsing_progress JSONB DEFAULT '{"current_page": 0, "total_pages": 0, "chunks_completed": 0}',
ADD COLUMN IF NOT EXISTS parsing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS parsing_completed_at TIMESTAMPTZ;

-- Add constraint for parsing_status
ALTER TABLE loan_documents 
ADD CONSTRAINT loan_documents_parsing_status_check 
CHECK (parsing_status IN ('idle', 'processing', 'completed', 'failed'));

-- Index for querying in-progress parsing jobs
CREATE INDEX IF NOT EXISTS idx_loan_documents_parsing_status 
ON loan_documents(parsing_status) 
WHERE parsing_status = 'processing';
```

---

### Phase 2: Create Shared PDF Utilities

**New file: `supabase/functions/_shared/pdfUtils.ts`**

This module will provide reusable utilities for PDF handling:

```typescript
// Key functions to implement:

// 1. Safe Base64 encoding (already in parse-loan-document)
export function safeBase64Encode(arrayBuffer: ArrayBuffer): string

// 2. Get PDF page count using pdf-lib
export async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number>

// 3. Extract specific page range from PDF
export async function extractPdfPages(
  pdfBytes: Uint8Array, 
  startPage: number, 
  endPage: number
): Promise<Uint8Array>

// 4. Merge extracted data from multiple chunks
export function mergeOcrData(
  existing: Record<string, any>, 
  newData: Record<string, any>,
  documentType: string
): Record<string, any>
```

---

### Phase 3: Refactor `parse-loan-document` Edge Function

**Updated file: `supabase/functions/parse-loan-document/index.ts`**

#### New Request Parameters
```typescript
interface ParseRequest {
  documentId: string;
  documentType: string;
  filePath: string;
  // New chunking parameters (optional - defaults for first invocation)
  currentPage?: number;     // Default: 1
  totalPages?: number;      // Calculated on first run
  accumulatedData?: Record<string, any>;  // Merged results from previous chunks
}
```

#### Processing Logic Changes

1. **Initial Invocation** (currentPage = 1 or undefined):
   - Download PDF from storage
   - Calculate total page count using pdf-lib
   - Update `parsing_status` to 'processing'
   - Extract first chunk (pages 1-5)
   - Send to AI for parsing
   - Store partial results in `ocr_data`
   - If more pages remain, trigger self-invocation

2. **Continuation Invocation** (currentPage > 1):
   - Download PDF and extract the specific chunk
   - Send to AI with context-aware prompt
   - Merge new results with `accumulatedData`
   - Update database with merged results
   - Continue or complete based on remaining pages

3. **Completion**:
   - Set `parsing_status` to 'completed'
   - Set `parsing_completed_at` timestamp
   - Final merged data stored in `ocr_data`

#### Self-Chaining Implementation
```typescript
// Fire-and-forget pattern (from send-bulk-email)
if (nextPage <= totalPages) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  fetch(`${supabaseUrl}/functions/v1/parse-loan-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      documentId,
      documentType,
      filePath,
      currentPage: nextPage,
      totalPages,
      accumulatedData: mergedData,
    }),
  }).then(res => {
    console.log(`[ParseDocument] Continuation triggered for page ${nextPage}`);
  }).catch(err => {
    console.error(`[ParseDocument] Failed to trigger continuation:`, err);
  });
}
```

---

### Phase 4: Refactor `parse-cibil-report` Edge Function

**Updated file: `supabase/functions/parse-cibil-report/index.ts`**

#### Critical Fix: Base64 Encoding Bug
Replace line 40:
```typescript
// BEFORE (causes stack overflow):
const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

// AFTER (safe for large files):
const bytes = new Uint8Array(arrayBuffer);
let binary = "";
for (let i = 0; i < bytes.byteLength; i++) {
  binary += String.fromCharCode(bytes[i]);
}
const base64Data = btoa(binary);
```

#### Add Chunked Processing
Same pattern as `parse-loan-document`:
- Page count detection
- Chunk extraction (3-5 pages for CIBIL reports)
- Self-chaining for continuation
- Merge results (credit score from page 1, account details from subsequent pages)

---

### Phase 5: Document-Type Specific Prompts for Chunked Parsing

Different document types need different merging strategies:

#### Bank Statements
```typescript
const BANK_STATEMENT_CHUNK_PROMPT = `
You are analyzing page(s) ${startPage}-${endPage} of a ${totalPages}-page bank statement.
Previous analysis found: ${JSON.stringify(previousData)}

For THIS chunk only, extract:
- transactions: Array of {date, description, debit, credit, balance}
- any new summary data if visible on these pages

Return JSON that can be MERGED with previous data.
`;

// Merge strategy: Concatenate transaction arrays, keep latest summary values
```

#### CIBIL Reports
```typescript
const CIBIL_CHUNK_PROMPT = `
You are analyzing page(s) ${startPage}-${endPage} of a ${totalPages}-page credit report.
Previous analysis found: ${JSON.stringify(previousData)}

Extract any NEW information visible on these pages:
- Additional accounts not previously captured
- DPD details for specific accounts
- Enquiry details

Return JSON to MERGE with existing data.
`;

// Merge strategy: Credit score from first chunk only, merge account arrays
```

---

### Phase 6: Frontend Updates

**Files to update:**
- `src/components/LOS/DocumentUpload.tsx`
- `src/components/LOS/Verification/CreditBureauDialog.tsx`

#### Changes Required

1. **Polling for Progress**: Since chunked parsing is async, implement polling:
```typescript
const { data: document, isLoading } = useQuery({
  queryKey: ["loan-document", documentId],
  queryFn: () => supabase.from("loan_documents").select("*").eq("id", documentId).single(),
  refetchInterval: (data) => 
    data?.parsing_status === 'processing' ? 2000 : false,
});
```

2. **Progress UI**: Show parsing progress to users:
```tsx
{document.parsing_status === 'processing' && (
  <div className="flex items-center gap-2">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-sm text-muted-foreground">
      Parsing page {document.parsing_progress?.current_page} of {document.parsing_progress?.total_pages}...
    </span>
  </div>
)}
```

3. **Handle Immediate Return**: First invocation returns immediately with status:
```typescript
// Response from chunked function
{
  success: true,
  status: "processing",  // Not "completed" 
  message: "Document parsing started (10 pages detected)",
  estimatedChunks: 2
}
```

---

### Phase 7: Error Handling & Recovery

#### Failure Recovery
```typescript
// In edge function, wrap chunk processing in try-catch
try {
  // Process chunk...
} catch (error) {
  // Mark as failed with error details
  await supabase
    .from("loan_documents")
    .update({
      parsing_status: 'failed',
      parsing_progress: {
        ...progress,
        error: error.message,
        failed_at_page: currentPage,
      },
    })
    .eq("id", documentId);
    
  // Don't trigger continuation
  throw error;
}
```

#### Retry Logic
Add a "Retry Parsing" button in the UI that:
1. Resets `parsing_status` to 'idle'
2. Clears `parsing_progress`
3. Re-invokes the edge function

---

## Implementation Checklist

### Backend Tasks
- [ ] Create database migration for new columns
- [ ] Create `supabase/functions/_shared/pdfUtils.ts` with utilities
- [ ] Refactor `parse-loan-document` for chunked processing
- [ ] Fix Base64 bug in `parse-cibil-report`
- [ ] Add chunked processing to `parse-cibil-report`
- [ ] Update `supabase/config.toml` (no changes needed - functions already configured)
- [ ] Add comprehensive logging for debugging

### Frontend Tasks
- [ ] Update `DocumentUpload.tsx` with polling and progress UI
- [ ] Update `CreditBureauDialog.tsx` with polling and progress UI
- [ ] Add retry functionality for failed parses
- [ ] Update toast messages for async processing feedback

### Testing Tasks
- [ ] Test with single-page documents (no chunking needed)
- [ ] Test with 10-page bank statement
- [ ] Test with 50-page bank statement
- [ ] Test with large CIBIL report
- [ ] Test failure recovery and retry
- [ ] Verify data merging accuracy for multi-page statements

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate**: The new optional parameters (`currentPage`, `totalPages`, etc.) are backward-compatible. Old invocations without these params will work as before (processing entire document in one request).

2. **Database**: New columns have defaults and won't affect existing records.

3. **Full Rollback**: Revert edge function code to previous version. New columns remain but are unused.

---

## Performance Considerations

| Metric | Before | After |
|--------|--------|-------|
| Max document size | ~5MB (payload limit) | Unlimited |
| Max pages parsed | ~15-20 (timeout) | Unlimited |
| Time for 50-page doc | Timeout/failure | ~3-5 minutes (background) |
| Memory usage | High (full doc in memory) | Low (chunk only) |
| API token efficiency | Single 4K response | Multiple focused responses |

---

## Future Enhancements

1. **pg_cron for stuck jobs**: Add a scheduled function to detect and retry stuck parsing jobs (status = 'processing' for > 10 minutes)

2. **Priority queue**: Process smaller documents first while large documents process in background

3. **Webhook notifications**: Notify frontend when background parsing completes instead of polling
