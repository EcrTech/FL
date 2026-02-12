

## Fix: Bulk Lead Upload RLS Violation on Contacts Table

### Problem

All 30 rows fail with "new row violates row-level security policy for table 'contacts'". The INSERT policy requires:
- `org_id = get_user_org_id(auth.uid())` -- looks up user's org from profiles table
- `created_by = auth.uid()`

If the logged-in user's profile row is missing or has a mismatched `org_id`, every insert fails.

### Solution

Create a backend function (edge function) to handle bulk lead insertion using the service role, which bypasses RLS. The frontend sends the CSV data to the edge function, which validates the user's auth token, then performs the inserts securely server-side.

### Changes

**New file: `supabase/functions/bulk-lead-upload/index.ts`**
- Accepts POST with array of lead rows
- Validates the user's JWT token from the Authorization header
- Looks up user profile to get org_id
- For each row:
  - Deduplicates contacts by phone within the org
  - Creates new contact with `created_by` set to authenticated user
  - Creates loan_application linked to the contact
- Returns summary: created count, skipped count, errors

**Modified file: `src/components/Pipeline/BulkLeadUploadDialog.tsx`**
- Replace direct Supabase client inserts with a single call to the `bulk-lead-upload` edge function
- Pass parsed CSV rows to the function via `supabase.functions.invoke("bulk-lead-upload", { body: { rows } })`
- Display results from the function response

### Why This Approach

- The edge function uses the service role key, so RLS policies don't block inserts
- User authentication is still verified server-side (JWT validation)
- Much faster: one network call instead of 30+ individual queries
- Eliminates dependency on `get_user_org_id` matching for client-side inserts
