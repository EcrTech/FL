
## Create Early Lead on Step 1 Completion

### Problem
Currently, a lead/contact record is only created when the user completes **all 4 steps** and submits the final application. This means users who complete Step 1 (enter name, phone, loan amount, verify OTP) and move to Step 2 do not appear in the pipeline at all. Most users drop off before completing all steps, so you lose visibility into these potential leads.

### Solution
Create an early lead record (in the `contacts` table and optionally a draft `loan_application`) as soon as the user completes Step 1 and moves to the contact details screen (Sub-step 2). This ensures every verified lead appears in the pipeline immediately.

### Implementation

**1. New Backend Function: `create-early-lead`**
- Create a new edge function that accepts minimal Step 1 data: name, phone, loan amount, referral code, UTM source, and geolocation.
- It will:
  - Look up the referral code to get `org_id` and `referrer user_id`
  - Check if a contact with the same phone already exists (deduplication)
  - If no existing contact, create a new `contacts` record with status `new` and source from UTM params
  - Create a draft `loan_application` record (status: `draft`, current_stage: `lead`) linked to the contact
  - Return the `contact_id` and `loan_application_id` (draft ID) to the frontend

**2. Frontend: Trigger on Step 1 Completion (`ReferralLoanApplication.tsx`)**
- In the `onContinue` handler for Sub-step 1 (where pixels already fire), add a call to the `create-early-lead` function.
- Store the returned `contact_id` and draft `loan_application_id` in component state.
- This call is fire-and-forget (non-blocking) so it doesn't slow down the user's progression to Sub-step 2.
- Use the existing `step1PixelFiredRef` guard to prevent duplicate lead creation on back-and-forth navigation.

**3. Final Submission Update (`submit-loan-application`)**
- Modify the existing edge function to accept and use the early-created `contact_id` and draft `loan_application_id`.
- Instead of always creating new records, it will update the existing draft application and contact created in Step 1.
- This avoids duplicate leads and ensures a clean transition from draft to submitted.

### Technical Details

**New file:** `supabase/functions/create-early-lead/index.ts`
```
Accepts: { name, phone, loanAmount, referralCode, source, geolocation }
Returns: { contactId, draftApplicationId }
```

**Modified file:** `src/pages/ReferralLoanApplication.tsx`
- Add async call to `create-early-lead` in the Step 1 onContinue handler
- Store returned IDs in state for use during final submission
- Guard against duplicate calls using existing ref

**Modified file:** `supabase/functions/submit-loan-application/index.ts`
- Add logic to detect and reuse an existing draft application and contact from early lead creation (this partially exists already with `draftApplicationId` support)

### What Changes for Users
- Leads appear in the pipeline immediately after Step 1 completion with status "New"
- Pipeline shows partial information (name, phone, amount, source) even if the user drops off
- Final submission updates the existing record rather than creating a duplicate
