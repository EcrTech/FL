

## Fix: Manual Bank Verification Upload Failure

### Root Cause

The manual verification mutation inserts a record into the `loan_verifications` table with an `org_id` field, but **this column does not exist** in the table. The insert fails with a database error, which causes the entire mutation to throw, and the error toast may show a generic message.

Even though the file upload to storage (step 1) may succeed, the subsequent database insert (step 3) fails, causing the overall operation to appear as though "the image is not uploading."

### Fix

**File: `src/components/LOS/BankDetailsSection.tsx`**

Remove the `org_id: orgId` field from the `loan_verifications` insert object (around line 223), since the table does not have an `org_id` column.

Before:
```typescript
const { error: verifyError } = await supabase
  .from("loan_verifications")
  .insert({
    loan_application_id: applicationId,
    applicant_id: applicantId,
    org_id: orgId,                    // <-- does not exist in table
    verification_type: "bank_manual",
    request_data: { utr: manualUtr.trim() },
    response_data: { file_url: fileUrl, file_path: filePath },
    status: "verified",
  } as any);
```

After:
```typescript
const { error: verifyError } = await supabase
  .from("loan_verifications")
  .insert({
    loan_application_id: applicationId,
    applicant_id: applicantId,
    verification_type: "bank_manual",
    request_data: { utr: manualUtr.trim() },
    response_data: { file_url: fileUrl, file_path: filePath },
    status: "verified",
  } as any);
```

### Files Changed

| File | Change |
|------|--------|
| `src/components/LOS/BankDetailsSection.tsx` | Remove non-existent `org_id` field from the `loan_verifications` insert |

