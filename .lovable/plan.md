
# Fix: E-Sign Dialog Notification Override Fields (Like eMandate)

## Problem Summary
The E-Sign dialog currently allows editing signer details, but:
1. **Unclear labels** - Fields labeled "Mobile Number" and "Email" don't make it clear that the signing link notifications will be sent there
2. **Bug** - Lines 141-145 use `useState()` incorrectly as an initializer instead of `useEffect` for syncing props to state
3. **No visual distinction** - Unlike the updated eMandate dialog, there's no "Notification Settings" section to clarify where the signing URL will be sent

## Solution Overview
Update `ESignDocumentDialog.tsx` to:
1. Fix the state sync bug (replace useState with useEffect)
2. Add separate "Notification Settings" section with clear labels
3. Add notification phone/email state variables (separate from signer details)
4. Update help text to make it clear these are where the signing link goes

---

## Changes Required

### File: `src/components/LOS/Sanction/ESignDocumentDialog.tsx`

#### Change 1: Add notification override state variables (after line 61)
```typescript
// Notification override fields (for testing or different notification recipient)
const [notificationPhone, setNotificationPhone] = useState(defaultSignerMobile);
const [notificationEmail, setNotificationEmail] = useState(defaultSignerEmail);
```

#### Change 2: Fix the state sync bug - replace incorrect useState with useEffect (lines 141-145)
**Before:**
```typescript
// Update form when defaults change
useState(() => {
  setSignerName(defaultSignerName);
  setSignerEmail(defaultSignerEmail);
  setSignerMobile(defaultSignerMobile);
});
```

**After:**
```typescript
// Reset form when dialog opens
useEffect(() => {
  if (open) {
    setSignerName(defaultSignerName);
    setSignerEmail(defaultSignerEmail);
    setSignerMobile(defaultSignerMobile);
    setNotificationPhone(defaultSignerMobile);
    setNotificationEmail(defaultSignerEmail);
    setSignerUrl(null);
  }
}, [open, defaultSignerName, defaultSignerEmail, defaultSignerMobile]);
```

#### Change 3: Add import for useEffect (line 1)
```typescript
import { useState, useEffect } from "react";
```

#### Change 4: Add Notification Settings section to the form (after Signature Position, around line 213)
```typescript
<hr className="my-4" />
<p className="text-sm font-medium text-muted-foreground">Notification Settings</p>
<p className="text-xs text-muted-foreground mb-2">
  The signing link will be sent to these contacts
</p>

<div className="space-y-2">
  <Label htmlFor="notifPhone">Notification Mobile</Label>
  <Input
    id="notifPhone"
    value={notificationPhone}
    onChange={(e) => setNotificationPhone(e.target.value)}
    placeholder="10-digit mobile number"
    type="tel"
  />
  <p className="text-xs text-muted-foreground">
    WhatsApp message with signing link will be sent here
  </p>
</div>

<div className="space-y-2">
  <Label htmlFor="notifEmail">Notification Email (Optional)</Label>
  <Input
    id="notifEmail"
    type="email"
    value={notificationEmail}
    onChange={(e) => setNotificationEmail(e.target.value)}
    placeholder="email@example.com"
  />
  <p className="text-xs text-muted-foreground">
    Email with signing link will be sent here
  </p>
</div>
```

#### Change 5: Update mutation call to use notification values (around line 107)
**Before:**
```typescript
signerEmail: signerEmail || undefined,
signerMobile: cleanMobile,
```

**After:**
```typescript
signerEmail: notificationEmail || undefined,
signerMobile: notificationPhone.replace(/\D/g, ""),
```

#### Change 6: Update validation to use notification phone (around line 93-97)
**Before:**
```typescript
const cleanMobile = signerMobile.replace(/\D/g, "");
if (cleanMobile.length < 10) {
  toast.error("Please enter a valid 10-digit mobile number");
  return;
}
```

**After:**
```typescript
const cleanMobile = notificationPhone.replace(/\D/g, "");
if (cleanMobile.length < 10) {
  toast.error("Please enter a valid 10-digit notification mobile number");
  return;
}
```

---

## Technical Summary

| Component | Current State | Updated State |
|-----------|--------------|---------------|
| Signer Name | Form field for Aadhaar name | Unchanged (used for signing) |
| Signer Mobile | Form field (used for signing + notification) | Separate from notification mobile |
| Signer Email | Form field (used for signing + notification) | Separate from notification email |
| Notification Mobile | N/A | New editable field |
| Notification Email | N/A | New editable field |

---

## Verification Steps
After implementation:
1. Open a loan application in disbursement stage
2. Click "E-Sign" on the Combined Loan Pack
3. Verify "Notification Settings" section appears below "Signature Position"
4. Enter different test values for Notification Mobile and Email
5. Submit the e-sign request
6. Verify WhatsApp and Email are sent to the test contacts (not the applicant's original details)
