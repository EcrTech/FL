

# Fix CORS Error on `send-public-otp` Edge Function

## Problem

When accessing the app from the custom domain `ps.in-sync.co.in`, the login flow calls the `send-public-otp` edge function. The browser's preflight (OPTIONS) request is rejected with a **406 status** because the `Access-Control-Allow-Headers` list is incomplete -- it's missing headers that the Supabase JS client automatically sends.

The error from the console:
```
Access to fetch at '.../send-public-otp' from origin 'https://ps.in-sync.co.in' has been blocked 
by CORS policy: Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## Root Cause

The current CORS headers only allow:
```
authorization, x-client-info, apikey, content-type
```

But the Supabase JS client also sends platform/runtime headers like `x-supabase-client-platform`, `x-supabase-client-platform-version`, etc. When the browser sees these unlisted headers, the preflight fails.

Additionally, the OPTIONS response uses `null` body which some edge runtimes may return as 406 instead of 204.

## Fix

**File:** `supabase/functions/send-public-otp/index.ts`

Two changes:

1. **Update `corsHeaders`** to include all Supabase client headers:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

2. **Return `'ok'` body** in OPTIONS handler instead of `null` to ensure a proper 200 status:
```typescript
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

Then redeploy the `send-public-otp` function.

