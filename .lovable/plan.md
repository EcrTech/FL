

# Fix CORS Headers Across All Edge Functions

## Problem

The e-sign flow fails with "Failed to send a request to the Edge Function" because `nupay-esign-request` and `send-esign-notifications` have the same outdated CORS headers that were already fixed in the OTP functions. In fact, **34 edge functions** still have this issue and will fail when called from the custom domain `ps.in-sync.co.in`.

## Fix

Update all 34 edge functions with two changes each:

1. **Replace the CORS headers** from:
```
"authorization, x-client-info, apikey, content-type"
```
to:
```
"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
```

2. **Replace OPTIONS handler** from `new Response(null, ...)` to `new Response('ok', ...)` wherever applicable.

## Affected Functions (all 34)

1. digilocker-callback
2. send-otp
3. send-application-confirmation
4. nupay-collection-webhook
5. videokyc-verify-token
6. verify-otp
7. referral-videokyc-upload
8. nupay-create-upi-collection
9. nupay-collection-authenticate
10. nupay-get-status
11. parse-loan-document
12. verifiedu-aadhaar-details
13. nupay-webhook-handler
14. equifax-credit-report
15. save-draft-application
16. verifiedu-public-aadhaar-initiate
17. verifiedu-bank-verify
18. nupay-esign-request
19. nupay-get-banks
20. videokyc-upload-recording
21. nupay-create-mandate
22. verifiedu-aadhaar-initiate
23. And remaining functions from the search results

Each function gets the same two-line fix (CORS headers + OPTIONS body). Then all functions will be redeployed.

## Expected Outcome

All edge function calls from the custom domain will pass CORS preflight checks, preventing "Failed to send a request to the Edge Function" errors across the entire application -- not just for e-sign, but for all features.

