
# Fix: Show Latest Uploaded Document in View Button

## Problem

When there are multiple document records for the same type (e.g., duplicate `pan_card` entries), the queries fetching identity documents don't sort by date. JavaScript's `.find()` returns the first match, which may be an older/stale record rather than the latest upload.

## Root Cause

Three queries need fixing -- they all fetch from `loan_documents` without `.order("created_at", { ascending: false })`:

1. **`VerificationDashboard.tsx`** (line 124-128) -- fetches identity docs for the PAN/Aadhaar cards
2. **`ApplicantProfileCard.tsx`** (line 280-284) -- fetches identity/photo docs for the profile card
3. **`DocumentUpload.tsx`** (line 80-83) -- fetches all documents for the upload section

## Fix

Add `.order("created_at", { ascending: false })` to each of these three queries. Since `.find()` returns the first match, ordering newest-first ensures it always picks the latest upload.

### Technical Changes

**1. `src/components/LOS/Verification/VerificationDashboard.tsx`**
Add ordering to the identity documents query:
```typescript
.in("document_type", ["pan_card", "aadhaar_card", "aadhaar_front", "aadhaar_back"])
.order("created_at", { ascending: false });
```

**2. `src/components/LOS/ApplicantProfileCard.tsx`**
Add ordering to the documents fetch:
```typescript
.in('document_category', ['identity', 'photo'])
.order('created_at', { ascending: false });
```

**3. `src/components/LOS/DocumentUpload.tsx`**
Add ordering to the documents query:
```typescript
.eq("loan_application_id", applicationId)
.order("created_at", { ascending: false });
```

This is a minimal 3-line change (one line per file) that ensures the View button always shows the most recently uploaded file.
