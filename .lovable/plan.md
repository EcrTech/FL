
# Fix E-Sign Email Notifications

## Problem
The E-Sign email notification is failing because the function requires an entry in the `email_settings` table with a `sending_domain`. The table is currently empty.

The OTP email functions work because they have a fallback to `noreply@in-sync.co.in` when org-specific email settings aren't configured.

## Solution
Update the `send-esign-notifications` Edge Function to use the same fallback pattern as the working OTP functions.

---

## Changes Required

### File: `supabase/functions/send-esign-notifications/index.ts`

**Current behavior (lines 243-254):**
```typescript
if (emailSettings?.sending_domain) {
  // send email
} else {
  results.push({ channel: "email", success: false, error: "Email settings not configured" });
}
```

**New behavior with fallback:**
```typescript
// Use org's verified domain if available, otherwise use global verified domain
const effectiveEmailSettings = emailSettings?.sending_domain 
  ? emailSettings 
  : { sending_domain: "in-sync.co.in", from_name: "E-Sign" };

const emailResult = await sendEmailNotification(
  signer_email,
  signer_name,
  signer_url,
  document_type,
  effectiveEmailSettings
);
results.push({ channel: "email", ...emailResult });
```

This will:
1. Try to use org-specific email settings from `email_settings` table
2. Fall back to `noreply@in-sync.co.in` (same verified domain used by OTP emails) if not configured

---

## Technical Details

| Aspect | Before | After |
|--------|--------|-------|
| Missing email_settings | Fails with error | Falls back to in-sync.co.in |
| From address | Only org-specific | Org-specific OR noreply@in-sync.co.in |
| Behavior matches | N/A | send-otp, send-public-otp |

No database changes required - this is purely an Edge Function update.
