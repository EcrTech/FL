

## Fix: Distinguish VerifiedU API Errors from Genuine Verification Failures

### Root Cause
The VerifiedU external API is returning `{"success": false, "message": "Something went wrong.", "data": null}` with HTTP status 200. This is a **server-side error on VerifiedU's end**, NOT an issue with the bank account details.

However, the current code treats this as a normal "verification failed" response, showing the misleading message "Bank verification failed - account details may be incorrect."

### Changes

#### 1. Edge Function: Check `responseData.success` field
**File:** `supabase/functions/verifiedu-bank-verify/index.ts`

After receiving the API response (line 99-100), add a check for `responseData.success === false`. When the API itself reports failure, return a different error response that distinguishes "API error" from "verification failed":

- If `responseData.success === false` and `responseData.data === null`: return `verification_status: "error"` with the actual API message ("Something went wrong")
- If `responseData.success === true` and `responseData.data.is_valid === false`: return `verification_status: "failed"` (genuine mismatch)
- If `responseData.success === true` and `responseData.data.is_valid === true`: return `verification_status: "success"`

Also skip saving to `loan_verifications` when it's an API error (not a real verification result).

#### 2. Frontend: Show appropriate error messages
**File:** `src/components/LOS/BankDetailsSection.tsx`

Update the verification response handler (around line 176-179) to check for the new `verification_status: "error"` value and show a different toast:

- `"success"` → "Bank account verified successfully" (green, unchanged)
- `"failed"` → "Bank verification failed - account details may be incorrect" (red, unchanged)
- `"error"` → "Bank verification service is temporarily unavailable. Please try again later." (yellow/warning)

### Technical Details

**Edge function change (around line 99):**
```
// After getting responseData:
if (!responseData.success || responseData.data === null) {
  // API-level failure, not a verification result
  return Response with {
    success: false,
    error: responseData.message || "Verification service error",
    verification_status: "error"
  }
}
```

**Frontend change (BankDetailsSection.tsx around line 176):**
```
if (data.verification_status === "success") {
  toast.success("Bank account verified successfully");
} else if (data.verification_status === "error") {
  toast.warning(data.error || "Verification service temporarily unavailable. Please try again later.");
} else {
  toast.error("Bank verification failed - account details may be incorrect");
}
```

### Immediate Action
The bank details themselves appear correct. Once the VerifiedU API recovers (or you can check with them about the "Something went wrong" error), verification should succeed. This code fix ensures users see the real problem instead of a misleading message.
