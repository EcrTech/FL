

# Fix CORS Error on `verify-public-otp` Edge Function

## Problem

The OTP verification step fails with "Failed to send a request to the Edge Function" because the `verify-public-otp` function has the same CORS issue we just fixed in `send-public-otp` -- incomplete `Access-Control-Allow-Headers` and a `null` OPTIONS response body.

## Fix

**File:** `supabase/functions/verify-public-otp/index.ts`

Two changes:

1. **Update `corsHeaders`** (line 6) to include all Supabase client headers:
```typescript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

2. **Return `'ok'` body** in OPTIONS handler (line 17) instead of `null`:
```typescript
return new Response('ok', { headers: corsHeaders });
```

Then redeploy `verify-public-otp`.

