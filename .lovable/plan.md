

## Fix: Video KYC Upload Edge Function Errors

### Problem Summary
The `referral-videokyc-upload` edge function is returning non-2xx errors due to two database schema mismatches:

### Issue 1: `loan_verifications` Insert Failure
**Error**: Attempting to insert `org_id` column that doesn't exist in the table

```typescript
// Current (BROKEN)
.upsert({
  loan_application_id: applicationId,
  org_id: orgId,  // Column doesn't exist!
  verification_type: "video_kyc",
  ...
})
```

**Fix**: Remove `org_id` from the insert and fix the upsert conflict handling.

---

### Issue 2: `videokyc_recordings` Insert Failure  
**Error**: `applicant_name` is NOT NULL but not being provided

```typescript
// Current (BROKEN)
.insert({
  org_id: orgId,
  application_id: applicationId,
  status: "completed",
  recording_url: recordingUrl,
  // Missing: applicant_name (required!)
})
```

**Fix**: Fetch applicant name from the application and include it in the insert.

---

### Implementation Changes

**File**: `supabase/functions/referral-videokyc-upload/index.ts`

#### 1. Update application query to get applicant name

```typescript
// Line 51-55 - Update query to get applicant info via relation
const { data: application, error: appError } = await supabase
  .from("loan_applications")
  .select("id, loan_applicants(first_name, last_name)")
  .eq("id", applicationId)
  .single();
```

#### 2. Fix loan_verifications upsert (remove org_id)

```typescript
// Lines 100-118 - Remove org_id, use INSERT instead of upsert
const { error: verificationError } = await supabase
  .from("loan_verifications")
  .insert({
    loan_application_id: applicationId,
    verification_type: "video_kyc",
    status: "success",
    response_data: {
      recording_url: recordingUrl,
      uploaded_at: new Date().toISOString(),
      source: "referral_application",
    },
    verified_at: new Date().toISOString(),
  });
```

#### 3. Fix videokyc_recordings insert (add applicant_name)

```typescript
// Lines 127-135 - Add applicant_name
const applicantData = application.loan_applicants?.[0];
const applicantName = applicantData 
  ? `${applicantData.first_name || ''} ${applicantData.last_name || ''}`.trim() 
  : 'Unknown Applicant';

const { error: recordingError } = await supabase
  .from("videokyc_recordings")
  .insert({
    org_id: orgId,
    application_id: applicationId,
    applicant_name: applicantName,  // Required field
    status: "completed",
    recording_url: recordingUrl,
    completed_at: new Date().toISOString(),
  });
```

---

### Technical Details

| Table | Issue | Fix |
|-------|-------|-----|
| `loan_verifications` | `org_id` column doesn't exist | Remove from insert |
| `loan_verifications` | No unique constraint on `loan_application_id,verification_type` | Use `insert` instead of `upsert` |
| `videokyc_recordings` | `applicant_name` is NOT NULL | Fetch and include applicant name |

---

### Expected Result
After this fix, applicants will be able to successfully complete the Video KYC step without encountering the "Edge Function returned a non-2xx status code" error.

