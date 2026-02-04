
# Add Notification Override Fields to eMandate Dialog

## Problem Summary
When creating an eMandate, notifications (WhatsApp + Email) are sent to the **primary applicant's stored contact details** rather than allowing you to specify different recipients for testing or when the account holder differs from the primary applicant.

## Solution Overview
Add editable "Notification Phone" and "Notification Email" fields to the eMandate dialog that:
1. Pre-populate with the primary applicant's details (current behavior)
2. Allow you to override them for testing or different account holders
3. Pass the overridden values to the notification edge function

---

## Changes Required

### File 1: `src/components/LOS/Mandate/CreateMandateDialog.tsx`

**Add new state variables** for notification overrides (after line 80):
```typescript
// Notification override fields (for testing or different account holder)
const [notificationPhone, setNotificationPhone] = useState(applicantPhone);
const [notificationEmail, setNotificationEmail] = useState(applicantEmail || "");
```

**Update useEffect** to reset notification fields when dialog opens (around line 191):
```typescript
setNotificationPhone(applicantPhone);
setNotificationEmail(applicantEmail || "");
```

**Add notification fields to Step 2 (Account Details)** - after the Account Type selector (around line 335):
```typescript
<hr className="my-4" />
<p className="text-sm font-medium text-muted-foreground">Notification Settings</p>
<div>
  <Label htmlFor="notifPhone">Notification Mobile</Label>
  <Input
    id="notifPhone"
    value={notificationPhone}
    onChange={(e) => setNotificationPhone(e.target.value)}
    placeholder="10-digit mobile number"
  />
  <p className="text-xs text-muted-foreground mt-1">
    Registration link will be sent to this number
  </p>
</div>
<div>
  <Label htmlFor="notifEmail">Notification Email (Optional)</Label>
  <Input
    id="notifEmail"
    type="email"
    value={notificationEmail}
    onChange={(e) => setNotificationEmail(e.target.value)}
    placeholder="email@example.com"
  />
</div>
```

**Update mutation payload** to use notification overrides (lines 149-150):
```typescript
mobile_no: notificationPhone.replace(/\D/g, "").slice(-10),
email: notificationEmail || undefined,
```

**Add notification details to confirmation step** (around line 445):
```typescript
<hr />
<div className="flex justify-between">
  <span className="text-muted-foreground">Notify Mobile</span>
  <span className="font-medium">{notificationPhone}</span>
</div>
{notificationEmail && (
  <div className="flex justify-between">
    <span className="text-muted-foreground">Notify Email</span>
    <span className="font-medium">{notificationEmail}</span>
  </div>
)}
```

---

## Technical Details

| Field | Default Value | Editable | Used For |
|-------|--------------|----------|----------|
| notificationPhone | Primary applicant's phone | Yes | WhatsApp notification |
| notificationEmail | Primary applicant's email | Yes | Email notification |

## Verification Steps
After implementation:
1. Open a loan application in disbursement stage
2. Click "Register eMandate"
3. Complete Step 1 (Bank Selection)
4. On Step 2 (Account Details), verify new "Notification Settings" section appears
5. Change the Notification Mobile and Email to test values
6. Complete the mandate creation
7. Verify notifications are sent to your test contact details
