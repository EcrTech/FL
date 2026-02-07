

# Fix: Permanent Login Flow Stability

## Problems Identified

### Problem 1: Edge Function OTP Call Failure
The error "Failed to send a request to the Edge Function" occurs when calling `send-public-otp`. There are zero logs for this function in the analytics, meaning requests aren't reaching it. This is likely caused by the auth state being in flux -- the user just signed out (line 118 of Login.tsx), and the Supabase client may briefly be in an inconsistent state when `supabase.functions.invoke()` is called immediately after `signOut()`.

### Problem 2: Auth Listener Race Condition (Recurring)
The `setTimeout` in AuthContext.tsx (line 292) defers user data fetching, causing ProtectedRoute to see `isInitialized=true` but `profile=null`, redirecting users back to login. Additionally, the `pendingOtpVerification` state in the useEffect dependency array (Login.tsx line 68) causes the auth subscription to be torn down and recreated during the 2FA flow, potentially missing events.

## Solution

### 1. Login.tsx -- Stabilize OTP flow and auth listener

- **Add a small delay after signOut before sending OTP**: Give the Supabase client time to complete the sign-out before invoking the edge function. This prevents the "Failed to send request" error.
- **Use a `useRef` for `pendingOtpVerification`**: Remove it from the useEffect dependency array so the auth listener is created once and never recreated during the 2FA flow.
- **Add retry logic for OTP sending**: If the edge function call fails, retry once after a short delay.

### 2. AuthContext.tsx -- Remove setTimeout race condition

- **Remove the `setTimeout` wrapper** around `fetchUserData` in the `SIGNED_IN` handler (lines 292-307).
- **Call `fetchUserData` directly**: The Supabase deadlock warning only applies to calling `supabase.auth.*` methods inside the callback. Fetching from database tables (`profiles`, etc.) is safe to await.
- **Remove `setIsLoading` toggling** inside the SIGNED_IN handler to prevent loading flickers.

## Technical Changes

### File: `src/pages/Login.tsx`

- Add `useRef` for pendingOtpVerification tracking
- Remove `pendingOtpVerification` from useEffect dependency array (line 68)
- Use `pendingOtpRef.current` inside the auth listener instead of the state variable
- Add a ~500ms delay after `signOut()` before calling `sendOtp()` to let the client stabilize
- Add retry logic in `sendOtp()` function with one automatic retry on failure

### File: `src/contexts/AuthContext.tsx`

- Replace the `setTimeout(async () => {...}, 0)` block (lines 292-307) with a direct `await fetchUserData()` call
- Remove `setIsLoading(true/false)` from the SIGNED_IN handler -- initial load already handles loading state
- Keep the `fetchInProgressRef` guard to prevent duplicate fetches

## Expected Outcome

- OTP sending will be more reliable since the client state is stable before the call
- Auth listener in Login.tsx won't be recreated during the 2FA flow
- AuthContext won't defer user data fetching, eliminating the redirect race condition
- The login flow will be permanently stable across sessions
