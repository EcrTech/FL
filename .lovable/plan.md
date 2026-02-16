
# Replace All `ps.in-sync.co.in` References with `paisaasaarthi.com`

## Summary
Replace the old domain `https://ps.in-sync.co.in` with `https://paisaasaarthi.com` across 4 files (28 occurrences found).

## Files to Update

### 1. `src/pages/LOS/MyReferrals.tsx` (line 14)
- Change `REFERRAL_BASE_URL` from `https://ps.in-sync.co.in/apply/ref` to `https://paisaasaarthi.com/apply/ref`

### 2. `src/pages/Profile.tsx` (line 18)
- Change `REFERRAL_BASE_URL` from `https://ps.in-sync.co.in/apply/ref` to `https://paisaasaarthi.com/apply/ref`

### 3. `index.html` (lines 38, 41)
- Update `og:url` meta tag to `https://paisaasaarthi.com`
- Update `canonical` link to `https://paisaasaarthi.com`

### 4. `supabase/functions/digilocker-callback/index.ts` (lines 115, 155)
- Update both fallback `FRONTEND_URL` values from `https://ps.in-sync.co.in` to `https://paisaasaarthi.com`
