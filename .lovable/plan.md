

## Fix: Storage Bucket File Size Limit

### Problem

The `loan-documents` storage bucket has a **5MB file size limit**. The Combined Loan Pack PDF (which now includes the full verbatim legal agreement text) exceeds this limit, causing a "413 Payload too large" error.

### Fix

**Database migration** to increase the file size limit on the `loan-documents` bucket from 5MB to 20MB:

```sql
UPDATE storage.buckets 
SET file_size_limit = 20971520  -- 20MB
WHERE id = 'loan-documents';
```

### Why 20MB?

- The Combined Loan Pack includes 4 documents: Sanction Letter, Loan Agreement (now longer with verbatim legal text), Daily Repayment Schedule, and Key Fact Statement
- 20MB provides comfortable headroom for all current and future document sizes
- This is still well within the platform's upload limits

### What Changes

| Change | Detail |
|---|---|
| Database migration | Increase `loan-documents` bucket `file_size_limit` from 5MB to 20MB |
| Code changes | None |

No code changes are needed -- the PDF generation and upload logic remains the same. Only the storage bucket configuration needs updating.

