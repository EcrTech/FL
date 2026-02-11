
## Fix: Remove Duplicate Leads from Pipeline View

### Problem
The Pipeline/Leads table shows multiple entries for the same person (same phone number). For example, Ankush Deshmukh (9168884111) appears 5 times.

### Business Rule
When duplicates exist (same phone number), show only one entry:
1. Keep the one that has progressed the furthest (most "processed")
2. If none are processed or multiple are at the same stage, keep the latest one (by creation date)

### Solution
Add client-side deduplication in `src/pages/PipelineBoard.tsx` after fetching applications and before rendering.

### Technical Details

**File: `src/pages/PipelineBoard.tsx`**

After line 350 (`const applications = applicationsData?.data || [];`), add deduplication logic:

1. Define a stage priority map to determine which application is "most processed":
   ```
   application_login < video_kyc < credit_assessment < approval_pending < sanctioned < disbursement_pending < disbursed
   ```
   (Higher number = more processed. `rejected` gets a moderate priority since it was actively reviewed.)

2. Group applications by phone number (from `getApplicantInfo`)
3. For each group, pick the one with the highest stage priority; ties broken by latest `created_at`
4. Applications without a phone number are always kept (no dedup key)

This approach:
- Keeps all data in the database untouched (no destructive deletions)
- Deduplicates only in the pipeline UI view
- Uses existing data (phone from `loan_applicants` or `contacts`) as the dedup key
- Preserves the ability to see all applications via other views (e.g., Advanced Search)

**Estimated changes**: ~30 lines added to one file (`PipelineBoard.tsx`)
