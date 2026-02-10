

## Make Location Capture Strictly Mandatory

### Problem
Currently, the referral application flow attempts to capture geolocation on page load and shows a warning if it fails, but users can still proceed through all steps without location. The location is only checked at the very end (before final submission in `handleVideoKycComplete`), which wastes the user's time if they complete all steps only to be blocked at submission.

### Solution
Block form progression at **Step 1** itself if location is not captured. The user must grant location permission before they can proceed to any subsequent step.

### Changes

**1. `src/pages/ReferralLoanApplication.tsx`**
- In `LoanRequirementsScreen`'s `onContinue` callback (sub-step 1 to sub-step 2 transition), add a check: if `geolocation` is null, show a toast error ("Please enable location access to continue") and call `captureGeolocation()` again instead of advancing.
- In `ContactConsentScreen`'s `onContinue` callback (step 1 to step 2 transition), add the same geolocation guard.
- Move the location error alert to be more prominent -- display it as a full-width blocking overlay/banner at the top of Step 1 content area with a clear "Enable Location" retry button.
- Keep the existing final check in `handleVideoKycComplete` as a safety net.

**2. `src/pages/PublicLoanApplication.tsx`** (same treatment for consistency)
- Add the same geolocation guard before allowing step progression, mirroring the referral flow logic.

### User Experience
- On page load, the browser prompts for location permission (existing behavior).
- If denied or unavailable, a prominent alert with a "Retry" button is shown.
- Tapping "Continue" on any step without location triggers a toast: "Please enable location access to continue" and re-attempts capture.
- Once location is captured, the flow proceeds normally.

### Technical Details
- The `onContinue` callbacks in Step 1 sub-screens will be wrapped with a location check:
  ```typescript
  const requireLocation = (callback: () => void) => {
    if (!geolocation) {
      toast.error("Please enable location access to continue");
      captureGeolocation();
      return;
    }
    callback();
  };
  ```
- This wrapper will be applied to: `setBasicInfoSubStep(2)`, `setCurrentStep(2)`, `setCurrentStep(3)` transitions, and `handleEnterVideoStep`.
- No database or backend changes needed -- the backend validation already enforces this on submission.

