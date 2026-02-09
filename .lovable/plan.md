

## Fix: Redeploy nupay-create-mandate Edge Function

### Root Cause

The `verify_jwt = false` change in `supabase/config.toml` was saved correctly, but the edge function gateway hasn't picked up the updated configuration. The function needs to be explicitly redeployed so the gateway applies the new `verify_jwt = false` setting.

The logs confirm this: the function boots but no request-level logs appear, meaning the gateway is rejecting the request **before** it reaches your code.

### Plan

1. **Redeploy the `nupay-create-mandate` function** -- This is the only action needed. No code changes required. The existing code and config are correct; the deployment just needs to be refreshed so the gateway stops enforcing JWT verification at the gateway level.

2. **Verify the fix** -- After redeployment, test the mandate creation flow again from the sanctions page.

### Technical Detail

| Item | Status |
|---|---|
| `config.toml` `verify_jwt = false` | Already correct |
| Edge function code (in-code auth via `getUser`) | Already correct |
| Function deployment | Needs refresh |

No file changes are needed -- only a redeployment of the function.

