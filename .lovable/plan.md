

## Manual Bank Verification Fallback

### Overview
When the VerifiedU bank verification API fails (returns a service error), a manual verification option will appear. The user must upload a screenshot of a Re 1 transfer to the target bank account, with the UTR number clearly visible. This serves as proof of a valid, active bank account.

### How It Works

1. When the automated "Verify Bank Account" button fails with a service error, a new "Manual Verification" section appears below.
2. The section shows:
   - Instructions: "Upload a screenshot of a Re 1 transfer to the applicant's bank account with UTR clearly visible"
   - A file upload input (accepts images: JPG, PNG, PDF)
   - A text input for the UTR number (mandatory)
   - A "Submit Manual Verification" button
3. On submission:
   - The screenshot is uploaded to storage at `loan-documents/{orgId}/{applicationId}/bank-verification-proof/`
   - A record is saved to `loan_verifications` with `verification_type: "bank_manual"` and relevant metadata (UTR, file URL)
   - The applicant's `bank_verified` is set to `true` and `bank_verified_at` is updated
   - A "Manually Verified" badge (distinct from the API-verified badge) is shown

### Technical Details

#### Database Changes
- Add a new column `bank_verification_method` (TEXT, nullable, default null) to `loan_applicants` to distinguish between `"api"` and `"manual"` verification methods.

#### File: `src/components/LOS/BankDetailsSection.tsx`
- Add state: `showManualVerification` (boolean), `manualUtr` (string), `manualProofFile` (File | null)
- After `verifyBankMutation` returns `verification_status === "error"`, set `showManualVerification = true`
- Add a new UI section (below the existing verify button) that renders when `showManualVerification` is true and bank is not yet verified:
  - File upload input for the Re 1 transfer screenshot
  - Text input for UTR number (required, validated for non-empty)
  - Submit button triggering a new `manualVerifyMutation`
- `manualVerifyMutation` logic:
  1. Upload file to `loan-documents/{orgId}/{applicationId}/bank-verification-proof/{timestamp}-{filename}`
  2. Get the public/signed URL
  3. Insert a `loan_verifications` record with `verification_type: "bank_manual"`, `request_data: { utr: manualUtr }`, `response_data: { file_url }`, `status: "verified"`
  4. Update `loan_applicants` with `bank_verified: true`, `bank_verified_at: now()`, `bank_verification_method: "manual"`
  5. Invalidate queries and show success toast
- Update the verified badge to show "Manually Verified" (orange/amber) vs "Verified" (green) based on `bank_verification_method`

#### Storage
- Uses the existing `loan-documents` bucket -- no new bucket needed
- File path pattern: `{orgId}/{applicationId}/bank-verification-proof/{file}`

#### Files Changed
| File | Change |
|------|--------|
| **Migration** | Add `bank_verification_method` column to `loan_applicants` |
| `src/components/LOS/BankDetailsSection.tsx` | Add manual verification UI, upload logic, and distinct badge |

