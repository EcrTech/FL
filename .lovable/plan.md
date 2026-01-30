

# Automated eMandate Notification Flow

## Overview
Create an automated notification system that sends the eMandate registration link to customers via WhatsApp and Email immediately after successful mandate registration - matching the existing E-Sign notification pattern.

---

## Architecture

```text
┌─────────────────────────┐
│  CreateMandateDialog    │
│  (Frontend)             │
└───────────┬─────────────┘
            │ 1. Create mandate
            ▼
┌─────────────────────────┐
│  nupay-create-mandate   │
│  (Edge Function)        │
└───────────┬─────────────┘
            │ 2. On success, call notification function
            ▼
┌─────────────────────────────────┐
│  send-emandate-notifications    │◄── NEW Edge Function
│  (Edge Function)                │
└───────────┬─────────────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
┌────────┐     ┌──────────┐
│ Email  │     │ WhatsApp │
│(Resend)│     │ (Exotel) │
└────────┘     └──────────┘
```

---

## Changes Required

### 1. New Edge Function: `send-emandate-notifications`

**File:** `supabase/functions/send-emandate-notifications/index.ts`

Creates a new edge function (modeled after `send-esign-notifications`) that:
- Accepts: `org_id`, `signer_name`, `signer_email`, `signer_mobile`, `registration_url`, `loan_no`, `collection_amount`, `channels`
- Sends Email via Resend with a professional template (green-themed like E-Sign)
- Sends WhatsApp via Exotel using an approved template
- Uses the same email domain fallback pattern (`in-sync.co.in`)

**Email Template Design:**
- Subject: "Complete Your eMandate Registration"
- Green gradient header with checkmark icon
- Clear call-to-action button
- Loan reference and EMI amount displayed
- Instructions for authentication

**WhatsApp Template:**
- Uses `emandate_request` template (2-variable UTILITY template)
- Variables: `{{1}}` = Customer Name, `{{2}}` = Registration URL
- Note: This template must be pre-approved in Exotel/WhatsApp Business

### 2. Update Edge Function: `nupay-create-mandate`

**File:** `supabase/functions/nupay-create-mandate/index.ts`

After successful mandate creation (when `registration_url` is returned):
1. Call `send-emandate-notifications` with customer details
2. Log notification results in the response
3. Continue existing flow (return registration URL to frontend)

**Key Addition (~20 lines):**
```typescript
// After successful mandate creation and before returning response:
if (registrationUrl) {
  try {
    const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/send-emandate-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        org_id: requestData.org_id,
        signer_name: requestData.account_holder_name,
        signer_email: requestData.email,
        signer_mobile: requestData.mobile_no,
        registration_url: registrationUrl,
        loan_no: requestData.loan_no,
        collection_amount: requestData.collection_amount,
        channels: ["whatsapp", "email"],
      }),
    });
    // Log result but don't fail mandate creation if notification fails
  } catch (notifyError) {
    console.warn("[Nupay-CreateMandate] Notification send failed:", notifyError);
  }
}
```

### 3. Update Config: `supabase/config.toml`

Add configuration for the new function:
```toml
[functions.send-emandate-notifications]
verify_jwt = false
```

---

## Database Changes
None required. The `nupay_mandates` table already has `mobile_no` and `email` fields.

---

## WhatsApp Template Requirement

A new WhatsApp template `emandate_request` needs to be registered with Exotel:
- Category: UTILITY
- Language: en
- Variables: 2 (Name, URL)
- Example body: "Dear {{1}}, please complete your eMandate registration by clicking: {{2}}"

Note: If this template doesn't exist yet, you'll need to create and get it approved in your Exotel/WhatsApp Business dashboard before WhatsApp notifications will work.

---

## Technical Summary

| Component | Action | Description |
|-----------|--------|-------------|
| `send-emandate-notifications/index.ts` | CREATE | New edge function for Email + WhatsApp delivery |
| `nupay-create-mandate/index.ts` | UPDATE | Call notification function after success |
| `supabase/config.toml` | UPDATE | Add function config |

---

## Flow After Implementation

1. User submits eMandate registration in `CreateMandateDialog`
2. `nupay-create-mandate` calls Nupay API and receives `registration_url`
3. Automatically triggers `send-emandate-notifications`
4. Customer receives WhatsApp message + Email with the link
5. Frontend still shows QR code and manual sharing options as backup

