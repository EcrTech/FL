
# Fix: Bank Details Auto-fill After Bank Statement Parsing

## Problem
After parsing a bank statement, the bank details are no longer automatically filling in the details page. This is a regression - it was working previously.

## Root Cause
The issue is a **React Query key mismatch**:

| Component | Query Key Used |
|-----------|----------------|
| `BankDetailsSection.tsx` | `["applicant-bank-details", applicantId]` |
| `DocumentUpload.tsx` | `["applicant-bank-details", applicationId]` |

Since `applicationId` and `applicantId` are different UUIDs, the cache invalidation in `DocumentUpload` never triggers a refetch in `BankDetailsSection`. The UI shows stale (empty) data because it doesn't know new OCR data is available.

## Solution

### 1. Update DocumentUpload Component Interface
Add the `id` field to the `Applicant` interface so we can access the applicant's ID:

```typescript
interface Applicant {
  id?: string;  // Add this
  first_name: string;
  last_name?: string;
  mobile?: string;
  pan_number?: string;
}
```

### 2. Fix Query Invalidation in parseMutation
Update line 212 to use `applicant?.id`:

```typescript
// Before
queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicationId] });

// After
if (applicant?.id) {
  queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicant.id] });
}
```

### 3. Fix Query Invalidation in handleParseAll
Update line 281 similarly:

```typescript
// Before
queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicationId] });

// After
if (applicant?.id) {
  queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicant.id] });
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/LOS/DocumentUpload.tsx` | Add `id` to Applicant interface, fix query invalidation keys |

## Expected Behavior After Fix

1. User uploads and parses a bank statement
2. AI extracts bank details (account number, IFSC, bank name, etc.)
3. `DocumentUpload` invalidates the correct query key using `applicantId`
4. `BankDetailsSection` refetches and detects new OCR data
5. Form auto-fills with extracted data and enters edit mode for user review

## Technical Details

The data flow relies on these interconnected queries:

```text
[DocumentUpload]                    [BankDetailsSection]
      |                                     |
      v                                     v
Parse bank_statement              Fetch applicant-bank-details
      |                                     |
      v                                     |
Store ocr_data in                          |
loan_documents table                       |
      |                                     |
      v                                     |
Invalidate queries:                        |
  - loan-documents                         |
  - bank-statement-parsed                  |
  - applicant-bank-details ----[BROKEN]--->X (wrong key!)
                                           |
                                     Never refetches
                                           |
                                     Shows stale/empty data
```

After fix:
```text
Invalidate queries:                        |
  - applicant-bank-details ----[FIXED]---->v
                                           |
                                     Refetches with new data
                                           |
                                     useEffect detects OCR data
                                           |
                                     Auto-fills form fields
                                           |
                                     Sets isEditing = true
```
