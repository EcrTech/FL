

# Fix: Address Save Hanging (Supabase Client Deadlock)

## Root Cause

The previous login fix removed `setTimeout` from the `onAuthStateChange` callback in `AuthContext.tsx` (line 294) and replaced it with a direct `await fetchUserData()`. This causes a **Supabase client deadlock**.

The Supabase documentation warns: *"You can easily create a dead-lock by using `await` on a call to another method of the Supabase library"* inside `onAuthStateChange`. This applies to ALL Supabase methods, including database queries -- not just `supabase.auth.*` methods.

`fetchUserData` makes 4 sequential/parallel Supabase database calls (`profiles`, `user_roles`, `organizations`, `designation_feature_access`). When these are awaited inside `onAuthStateChange`, the Supabase client's internal lock is held, blocking all other operations. This is why the `loan_applicants` update hangs indefinitely -- it's waiting for the client lock that's held by the auth callback.

## Why the Login Fix Created This Problem

```text
Previous code (with setTimeout):
  onAuthStateChange -> setTimeout -> fetchUserData
  Result: Login race condition (profile loads too late)

Current code (direct await):
  onAuthStateChange -> await fetchUserData (holds client lock)
  Result: ALL subsequent DB calls hang (address save, etc.)
```

## Solution: Event-Driven Fetch with useEffect

Instead of calling `fetchUserData` inside the callback OR deferring it with `setTimeout`, use a **React state flag** to trigger a `useEffect` that runs the fetch outside the callback context.

```text
onAuthStateChange -> set pendingUser state (no await, no Supabase calls)
useEffect [pendingUser] -> await fetchUserData (runs outside callback)
```

This approach:
- Breaks out of the `onAuthStateChange` callback immediately (no deadlock)
- Triggers synchronously via React state (no `setTimeout` delay)
- Fetches user data before `isInitialized` is set (no race condition with ProtectedRoute)

## Technical Changes

### File: `src/contexts/AuthContext.tsx`

1. Add a new state: `pendingSignInUser` to hold the user object when SIGNED_IN fires
2. In the `onAuthStateChange` SIGNED_IN handler: Instead of `await fetchUserData()`, just set `setPendingSignInUser(currentSession.user)` -- no Supabase calls inside the callback
3. Add a new `useEffect` that watches `pendingSignInUser`: When it changes, call `await fetchUserData(pendingSignInUser)` and then clear it
4. Keep `initAuth` unchanged -- it runs outside the callback and works correctly
5. Keep `isInitializingRef` guard to prevent double-fetching during initial load

### No changes needed to:
- `Login.tsx` (the ref-based listener fix is still correct)
- `ProtectedRoute.tsx` (already waits for `isInitialized` and `isLoading`)
- `ApplicationDetail.tsx` (the save mutation code is correct; it just hangs due to the deadlock)

