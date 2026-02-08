

## Unify Loan Detail Pages Across All Stages

The investigation found significant inconsistencies between `ApplicationDetail` and `SanctionDetail`. The `SanctionDashboard` component is also stale and unused. This plan brings all detail pages into alignment.

---

### Discrepancies Found

| Section | ApplicationDetail | SanctionDetail |
|---|---|---|
| Quick Stats (Amount, Tenure, Applicant, Assigned To, Location, Case History) | Yes | Missing |
| ApplicantProfileCard | Yes (with applicantId) | Yes (without applicantId) |
| Applicant Details (editable) | Yes, with edit/save, OCR auto-create, referrals | Read-only, no referrals |
| Bank Details | Yes | Missing |
| Verified Document Data (PAN/Aadhaar OCR) | Yes | Missing |
| Document Upload | Yes | Missing |
| Document Data Verification | Yes | Missing |
| Approval History | Yes (conditional) | Missing |
| Application Summary | Yes (conditional) | Missing |
| Case History | Yes | Missing |
| GST on Processing Fee | Shown in ApplicationSummary | Not shown |
| Interest Rate label | N/A | Shows "% p.a." (wrong -- should be "% per day") |

Additionally, `SanctionDashboard.tsx` is an orphaned component -- not rendered anywhere -- and still uses the old "% p.a." model.

---

### Plan

#### 1. Delete `SanctionDashboard.tsx` (orphaned component)

This component is not imported or rendered anywhere. Remove it to avoid confusion.

#### 2. Update `SanctionDetail.tsx` to match `ApplicationDetail.tsx` sections

Add the missing sections to `SanctionDetail` so the page shows identical information cards:

- **Quick Stats grid**: Requested Amount, Tenure, Applicant, Assigned To (with AssignmentDialog), Location, Case History (with CaseHistoryDialog)
- **Applicant Details Card**: Use the same editable card with Gender, Marital Status, Religion, PAN, Mobile, Address fields + edit/save capability
- **Referrals Section**: Add the same ReferralsSection component (professional + personal refs, additional referrals)
- **Bank Details**: Add `BankDetailsSection`
- **Verified Document Data**: Add the PAN + Aadhaar OCR data card
- **Document Data Verification**: Add `DocumentDataVerification`
- **Document Upload**: Add `DocumentUpload`
- **Approval History**: Add `ApprovalHistory`
- **Application Summary**: Add `ApplicationSummary`

This requires:
- Expanding the Supabase query in SanctionDetail to fetch `loan_verifications`, `contacts`, `assigned_profile`, and `loan_documents`
- Adding state management for editing applicant details and referrals
- Importing all the missing components

#### 3. Fix interest rate display

- Update any remaining references showing "% p.a." to "% per day" to match the daily rate model

#### 4. Ensure GST on Processing Fee is consistent

- Already fixed in `ApplicationSummary` -- will be inherited by SanctionDetail once ApplicationSummary is added there

---

### Files Changed

| File | Change |
|---|---|
| `src/components/LOS/Sanction/SanctionDashboard.tsx` | Delete (orphaned) |
| `src/pages/LOS/SanctionDetail.tsx` | Major update: add Quick Stats, editable Applicant Details with Referrals, Bank Details, Verified Document Data, Document Upload, Document Data Verification, Approval History, Application Summary, Case History, Assignment Dialog |

### Technical Notes

- The `ReferralsSection` component is currently defined inline in `ApplicationDetail.tsx`. To reuse it in SanctionDetail, it will either be extracted to a shared file or duplicated. Extracting is preferred for maintainability.
- The SanctionDetail-specific content (SanctionGenerator button, Upload Signed Document, DisbursementDashboard) remains unchanged at the bottom of the page.
- The ApplicantProfileCard call will be updated to include the `applicantId` prop for consistency.

