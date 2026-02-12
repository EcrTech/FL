

## Remove Old Public Loan Application Form

The old form (`PublicLoanApplication`) at route `/apply/:slug` is no longer in use. The current active form is `ReferralLoanApplication` at `/apply/ref/:referralCode`. The old form and all its components need to be deleted.

### Files to Delete (10 files)

**Page:**
- `src/pages/PublicLoanApplication.tsx`

**Components (entire folder):**
- `src/components/PublicLoanApplication/AddressDetailsStep.tsx`
- `src/components/PublicLoanApplication/ConsentOTPStep.tsx`
- `src/components/PublicLoanApplication/DocumentUploadStep.tsx`
- `src/components/PublicLoanApplication/EmploymentDetailsStep.tsx`
- `src/components/PublicLoanApplication/LoanDetailsStep.tsx`
- `src/components/PublicLoanApplication/PersonalDetailsStep.tsx`
- `src/components/PublicLoanApplication/ReviewStep.tsx`
- `src/components/PublicLoanApplication/StateCityMap.ts`
- `src/components/PublicLoanApplication/SuccessScreen.tsx`

### Files to Edit (1 file)

**`src/App.tsx`:**
- Remove the import of `PublicLoanApplication`
- Remove the route `<Route path="/apply/:slug" element={<PublicLoanApplication />} />`

### Impact
- Removes ~10 unused files and cleans up the router
- No effect on the current referral form (`/apply/ref/:referralCode`)
- Anyone hitting `/apply/:slug` will get a 404, which is expected since this form is deprecated

