

## Fix: Signed Document Not Viewable

### Root Cause

The e-sign edge function (`nupay-esign-status`) stores signed documents at:
```
signed/{application_id}/combined_loan_pack_signed_xxx.pdf
```

But the storage security policy for viewing files in the `loan-documents` bucket requires the **first folder** in the path to match the user's **org_id**:
```
(storage.foldername(name))[1] must match profiles.org_id
```

So the signed document exists in storage but the app cannot read it because the path `signed/...` does not start with the org_id.

For comparison, the manual upload dialog correctly uses:
```
{orgId}/{applicationId}/signed/{file}
```

### Fix (Two Parts)

#### 1. Fix the edge function path (prevent future issues)

Update `supabase/functions/nupay-esign-status/index.ts` to include the org_id as the first folder in the signed document path, matching the pattern used by the manual upload:

```
Before: signed/{application_id}/{document_type}_signed_{timestamp}.pdf
After:  {org_id}/{application_id}/signed/{document_type}_signed_{timestamp}.pdf
```

This requires fetching the `org_id` from the `loan_applications` table (or from the `document_esign_requests` record).

#### 2. Fix the existing Anupam Roy record (fix current data)

Run a storage move or update the `signed_document_path` in the `loan_generated_documents` table after moving the file to the correct org-prefixed path. Alternatively, add a storage policy that also allows access to the `signed/` prefix for authenticated users.

**Recommended approach**: Add a supplementary storage SELECT policy that allows authenticated users to also access files under the `signed/` prefix. This immediately fixes Anupam Roy's record and any other legacy signed docs, while also updating the edge function for future correctness.

### Technical Details

| File | Change |
|---|---|
| `supabase/functions/nupay-esign-status/index.ts` | Update signed document upload path to include org_id as first folder |
| Database migration | Add storage policy: allow authenticated users to SELECT from `loan-documents` where path starts with `signed/` |

### Storage Policy SQL

```sql
CREATE POLICY "Authenticated users can view signed loan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] = 'signed'
);
```

### Edge Function Path Fix

Both upload locations in the edge function (around lines 279 and 371) will be updated to:
```typescript
const fileName = `${orgId}/${esignRecord.application_id}/signed/${esignRecord.document_type}_signed_${Date.now()}.pdf`;
```

The `org_id` will be fetched from the `loan_applications` table using the `application_id` already available in the e-sign record.
