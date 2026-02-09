

## Fix: Stale Session Token Causing 401 on Mandate Creation

### Root Cause

The 401 error is NOT a gateway issue — it comes from line 72 of the edge function code. Here is what happened:

1. User `a@in-sync.co.in` logged in (session `14f456ab...` created)
2. User logged out and logged back in (old session destroyed, new session created)
3. The browser client still holds the OLD session's JWT token in memory/localStorage
4. The edge function calls `supabase.auth.getUser(token)` which checks session validity server-side
5. Auth server responds "session not found" and the function returns 401

The `verify_jwt = false` config change is working correctly — the request does reach the function. The problem is stale client-side auth state.

### Plan

**1. Client-side fix — Force session refresh before calling the function**

In `CreateMandateDialog.tsx`, replace the simple `getSession()` check (which returns cached/stale data) with a proper token refresh:

```
// BEFORE (line 134):
const { data: { session } } = await supabase.auth.getSession();

// AFTER:
const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
if (sessionError || !session) {
  // Force re-login if session is truly dead
  await supabase.auth.signOut();
  throw new Error("Session expired. Please log in again.");
}
```

This ensures the client sends a fresh, valid token every time.

**2. Edge function improvement — Better error messaging**

In `nupay-create-mandate/index.ts`, update the `getUser` error response (line 72) to provide a more actionable error message so the client can handle it:

```
// BEFORE:
{ error: "Invalid authorization token" }

// AFTER:
{ error: "Session expired or invalid. Please log in again.", code: "SESSION_EXPIRED" }
```

**3. Client-side error handling — Auto-redirect on session expiry**

In the mutation's `onError` handler, detect the session expiry error and prompt re-login rather than showing a generic toast.

### Files to Modify

| File | Change |
|---|---|
| `src/components/LOS/Mandate/CreateMandateDialog.tsx` | Use `refreshSession()` instead of `getSession()` before invoking the function; handle session expiry in `onError` |
| `supabase/functions/nupay-create-mandate/index.ts` | Improve error message to include `code: "SESSION_EXPIRED"` for client-side detection |

### Immediate Workaround

Refreshing the page or logging out and back in will fix the issue right now, since the Supabase client will pick up the new session on page load.

