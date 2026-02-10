
## Comprehensive Feature Implementation Plan

This plan covers 13 distinct features/fixes requested. They are grouped into manageable work items.

---

### 1. Duplicate Leads Removal from Pipeline View

**Problem**: The Pipeline Board (`PipelineBoard.tsx`) may show duplicate contacts/leads.

**Fix**:
- In the `useCollections` or pipeline query, add deduplication logic based on phone number
- For CallingUploadLeads: Add a `phone` uniqueness check before inserting (both single add and CSV bulk upload) using `.select()` before `.insert()`, or use an upsert with `ON CONFLICT`
- Display a count of skipped duplicates after CSV upload

**Files**: `src/pages/CallingUploadLeads.tsx`, `src/pages/PipelineBoard.tsx`

---

### 2. Move Bulk Upload to Pipeline, Remove from Upload Leads Page

**Problem**: Bulk CSV upload exists on the Upload Leads page but should be available from the Pipeline page instead.

**Fix**:
- Add "Upload CSV" button to `PipelineBoard.tsx` header, copying the CSV upload logic from `CallingUploadLeads.tsx`
- Remove the Upload CSV button from `CallingUploadLeads.tsx` (keep manual "Add Lead" only)
- The CSV upload on Pipeline should create `loan_applications` (not just contacts), with source detection from the CSV or a dropdown selector

**Files**: `src/pages/PipelineBoard.tsx`, `src/pages/CallingUploadLeads.tsx`

---

### 3. Marketing Pixel Source Tracking in Referral Flow

**Problem**: The `loan_applications.source` column exists but only stores "referral" or "referral_link". No UTM parameter capture from Google/Meta campaigns.

**Fix**:
- In `ReferralLoanApplication.tsx` and `PublicLoanApplication.tsx`, capture UTM parameters from the URL (`utm_source`, `utm_medium`, `utm_campaign`) on page load
- Store a more descriptive `source` value: map `utm_source=google` to "Google Ads", `utm_source=facebook`/`utm_source=meta` to "Meta Ads", etc.
- Update `SOURCE_OPTIONS` and `SOURCE_DISPLAY` in `PipelineBoard.tsx` to include "Google Ads" and "Meta Ads"
- Verify analytics pixel scripts are present in `index.html` (Google Tag AW-17871680753 and Meta Pixel 2454408188319767)

**Files**: `src/pages/ReferralLoanApplication.tsx`, `src/pages/PublicLoanApplication.tsx`, `src/pages/PipelineBoard.tsx`, `index.html`

---

### 4. Disbursed Clients Not Showing in Collections + Due Date Filter + Sorting

**Problem**: The Collections query fetches from `loan_repayment_schedule` filtered by `org_id`, but disbursed applications may not have repayment schedules generated yet, or the join is failing.

**Fix**:
- Verify the `useCollections` hook query joins correctly with disbursed applications
- Add a **due date range filter** (from/to date pickers) in `CollectionsTable.tsx`
- Add **sorting by latest due date** (toggle ascending/descending on the Due Date column header)
- Default sort: latest due date first (descending)

**Files**: `src/hooks/useCollections.ts`, `src/components/LOS/Collections/CollectionsTable.tsx`, `src/pages/LOS/Collections.tsx`

---

### 5. Document Fraud Detection AI Tool

**Problem**: No automated document fraud detection exists.

**Fix**:
- Create a new edge function `detect-document-fraud` that uses Lovable AI (Gemini) to analyze uploaded documents for signs of fraud (tampering, inconsistent fonts, altered numbers, mismatched data across documents)
- The function takes an application ID, fetches all uploaded document images from storage, and sends them to the AI model for analysis
- Add a "Fraud Check" button in the `DocumentUpload.tsx` component that triggers this analysis
- Display results as a card showing risk score (Low/Medium/High) and specific findings
- Store results in `loan_verifications` table with `verification_type = 'document_fraud_check'`

**Files**:
- New: `supabase/functions/detect-document-fraud/index.ts`
- Modified: `src/components/LOS/DocumentUpload.tsx`, `src/components/LOS/DocumentDataVerification.tsx`

---

### 6. Back Button Sticky Path (Browser History)

**Problem**: The back button in `ApplicationDetail.tsx` always navigates to `/los/applications` regardless of where the user came from.

**Fix**:
- Replace `navigate("/los/applications")` with `navigate(-1)` to use browser history
- Add a fallback: if there's no history entry (direct URL access), fall back to `/los/applications`

**File**: `src/pages/LOS/ApplicationDetail.tsx` (line 467)

---

### 7. UTR Proof Visibility After Disbursal

**Problem**: `DisbursementStatus.tsx` shows proof info correctly, but the "View Proof" button fetches a signed URL that may expire or the component may not render for certain stages.

**Fix**:
- Verify `DisbursementStatus` renders for `disbursed` stage (currently correct at line 1011)
- Ensure the proof document path is stored correctly in `loan_disbursements.proof_document_path`
- The "View Proof" button already exists -- debug whether `proof_document_path` is actually being saved during the upload flow in `ProofUploadDialog.tsx`
- Add proof document link directly visible (not behind a button click) for completed disbursements

**File**: `src/components/LOS/Disbursement/DisbursementStatus.tsx`

---

### 8. OD (Overdue) Bucket Report -- 30/60/90 Days

**Problem**: No overdue aging report exists.

**Fix**:
- Add a new tab "OD Buckets" in the `Reports.tsx` page
- Create a new component `src/components/LOS/Reports/OverdueBucketReport.tsx`
- Query `loan_repayment_schedule` for overdue EMIs (status = 'pending' AND due_date < today)
- Categorize into buckets: 1-30 days, 31-60 days, 61-90 days, 90+ days
- Display summary cards (count + amount per bucket) and a detailed table with applicant info
- Include CSV export functionality

**Files**:
- New: `src/components/LOS/Reports/OverdueBucketReport.tsx`
- Modified: `src/pages/Reports.tsx`

---

### 9. Repeat Loan Option for Disbursed Cases

**Problem**: No mechanism to offer a repeat loan without fresh document collection.

**Fix**:
- Add a "Repeat Loan" button on the `ApplicationDetail.tsx` page when `current_stage === "disbursed"` and all EMIs are paid (or manually triggered)
- The button creates a new `loan_application` record linked to the same contact, copies over existing applicant data, and links to existing documents
- Set `source = "repeat_loan"` and store a `parent_application_id` reference (new column in `loan_applications`)
- The new application starts at `assessment` stage, skipping document collection

**Files**:
- DB migration: Add `parent_application_id` column to `loan_applications`
- Modified: `src/pages/LOS/ApplicationDetail.tsx`
- New: `src/components/LOS/RepeatLoanDialog.tsx`

---

### 10. Staff-wise Performance Dashboard

**Problem**: The current Reports page shows CRM-style sales performance but not LOS-specific staff metrics (leads to disbursement funnel, collections performance).

**Fix**:
- Add a new tab "Staff Performance" in Reports
- Create `src/components/LOS/Reports/StaffPerformanceDashboard.tsx`
- Metrics per staff member: Leads assigned, Applications processed, Approvals, Sanctions generated, Disbursements completed, Collection rate
- Query `loan_applications` grouped by `assigned_to` across stages
- Include date range filter and CSV export

**Files**:
- New: `src/components/LOS/Reports/StaffPerformanceDashboard.tsx`
- Modified: `src/pages/Reports.tsx`

---

### 11. UMRN Number Visibility After NACH Activation

**Problem**: UMRN is stored in the `nach_mandates` table but not displayed on the application detail page.

**Fix**:
- In `ApplicationDetail.tsx`, query `nach_mandates` for the application and display UMRN when status is active
- Add a small info card in the disbursement/post-disbursement section showing UMRN, mandate status, and amount

**Files**: `src/pages/LOS/ApplicationDetail.tsx` or create a new component `src/components/LOS/Mandate/MandateStatusCard.tsx`

---

### 12. Lock Loan Details After Disbursal

**Problem**: All fields remain editable even after disbursal.

**Fix**:
- In `ApplicationDetail.tsx`, add a `isLocked` flag: `const isLocked = application.current_stage === "disbursed" && !application.parent_application_id`
- When locked, hide all "Edit" buttons and disable mutation triggers for applicant details, referrals, documents, bank details
- For repeat loans (where `parent_application_id` exists and new loan is not yet disbursed), keep editing enabled

**File**: `src/pages/LOS/ApplicationDetail.tsx`

---

### 13. Repeat Loan Unlocks Editing Until Disbursed

This is covered by item 12 above. The `isLocked` logic checks both the stage AND whether it's a repeat loan in progress.

---

### Implementation Order

| Phase | Items | Effort |
|-------|-------|--------|
| Phase 1 (Quick fixes) | #6 Back button, #7 UTR proof, #11 UMRN display, #12 Lock after disbursal | Low |
| Phase 2 (Collections) | #4 Collections fix + filters, #8 OD Bucket report | Medium |
| Phase 3 (Pipeline) | #1 Duplicate leads, #2 Bulk upload move, #3 UTM source tracking | Medium |
| Phase 4 (New features) | #5 Fraud detection AI, #9 Repeat loan, #10 Staff dashboard | High |

### Technical Notes

- **Database migrations needed**: Add `parent_application_id` column to `loan_applications` (for repeat loans)
- **New edge function**: `detect-document-fraud` (uses Lovable AI / Gemini for image analysis)
- **No new dependencies required** -- all features use existing libraries
- Marketing pixel verification requires checking `index.html` for correct script tags
