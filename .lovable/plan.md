

## Fix: "Nupay configuration not found" Error

### Root Cause

The `CreateMandateDialog` defaults the `environment` state to `"uat"`. It tries to fetch the active Nupay config from the database to determine the correct environment, but if that query fails silently (e.g., due to RLS/timing), the environment stays as `"uat"`.

Your database has:
- UAT config: `is_active = false`
- Production config: `is_active = true`

So the edge function receives `environment = "uat"` and queries for a config where `environment = "uat" AND is_active = true` -- which returns nothing, causing the 404.

### Fix

**1. Change the default environment to match the active config**

In `CreateMandateDialog.tsx` (line 94), change the default from `"uat"` to `"production"` as a safer fallback. But more importantly:

**2. Don't rely on the default -- derive environment from the fetched config**

Update the mutation to use the config's environment directly rather than the state variable, ensuring we never send a stale/default value:

```
// In the mutation, get the environment from the config query result, not state
const activeEnv = config?.environment || environment;
```

**3. Add error logging in the edge function**

Add a `console.log` before the config query in `nupay-create-mandate/index.ts` to log `org_id` and `environment` values being queried, so future issues are easier to debug.

**4. Fix the NupaySettings `configs?.find is not a function` error**

The `useOrgData` hook or another mechanism may be returning the configs in an unexpected format. Add a safety check to ensure `configs` is always treated as an array.

### Files to Modify

| File | Change |
|---|---|
| `src/components/LOS/Mandate/CreateMandateDialog.tsx` | Use `config?.environment` directly in the mutation body instead of relying on the `environment` state variable; change default to `"production"` |
| `supabase/functions/nupay-create-mandate/index.ts` | Add `console.log` for debugging the `org_id` and `environment` values before the config query |

### Technical Detail

The key change in `CreateMandateDialog.tsx`:

```typescript
// Line 143: Instead of sending the state variable
environment: config?.environment || environment,
```

This ensures that even if the state hasn't updated from the query result, the actual config's environment is sent.

