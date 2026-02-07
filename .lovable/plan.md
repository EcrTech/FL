

# Fix: Video KYC Status Not Updating After Retry Link Generation

## Problem

When a loan officer generates a "Retry Link" for Video KYC, the UI still shows the **old** completed recording as verified (green checkmark). The applicant's new recording from the retry link won't be reflected because:

1. The `videokyc-create-retry-link` function only deletes old `pending/failed/expired` recordings -- it does NOT invalidate the previous **completed** recording or the `loan_verifications` entry
2. The UI reads from `loan_verifications` first, which still has the old `success` status pointing to the old recording URL
3. Even after the applicant completes the retry, the `videokyc-upload-recording` function correctly updates `loan_verifications`, but until then, the old data persists

## Current Data State (this application)

- Old recording (Feb 6): status `completed`, has recording URL
- New retry recording (Feb 7): status `pending`, no recording URL (applicant hasn't completed it yet)
- `loan_verifications`: Still shows `success` with old Feb 6 recording URL

## Solution

Update the `videokyc-create-retry-link` backend function to **invalidate the old verification** when a retry is requested. This ensures the UI correctly reflects that a new Video KYC is pending.

## Technical Changes

### 1. Update `supabase/functions/videokyc-create-retry-link/index.ts`

After deleting old pending/failed/expired recordings, add logic to:
- Update the existing `loan_verifications` record for this application's `video_kyc` type, setting its status to `pending` and adding a remark like "Retry requested"
- This makes the UI show the Video KYC as "not verified" until the applicant completes the new recording

### 2. Update `src/components/LOS/ApplicantProfileCard.tsx`

Update the `handleVideoKYCClick` function to also check `videokyc_recordings` for a `pending` status. If a pending retry exists:
- Show the retry link dialog (with the existing pending link info) instead of the old completed recording
- This handles the edge case where the verification was just invalidated

### 3. Fix existing data

Run a one-time database update to set the current `loan_verifications` record for this application to `pending` status, so the UI immediately reflects the correct state.

