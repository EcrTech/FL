
# Send WhatsApp Application Confirmation on Submission

## Overview
When a loan application is submitted, automatically send a WhatsApp message using the Meta-approved `app_confirmation` template with:
- **Variable 1**: Applicant's Name
- **Variable 2**: Application Number (loan account number)

## Template Details
Based on the screenshot provided:
- **Template Name**: `app_confirmation`
- **Language**: English
- **Body**: "Dear {{1}} Thanks for your application Your application ID is {{2}}. Our team will get in touch with you soon."

## Implementation Approach

### Create a New Edge Function
Create a dedicated `send-application-confirmation` edge function that:
1. Takes applicant details (name, phone, application number, org_id)
2. Fetches WhatsApp settings for the organization
3. Sends the `app_confirmation` template via Exotel API
4. Logs the message in `whatsapp_messages` table

### Trigger Points
Modify `submit-loan-application` to call the notification function at two points:

| Application Type | Trigger Location | Applicant Name Source | Phone Source |
|-----------------|------------------|----------------------|--------------|
| Referral Application | After line 371 | `body.applicant.name` | `body.applicant.phone` |
| Public Form Application | After line 716 | `body.personalDetails.fullName` | `body.personalDetails.mobile` |

## Technical Details

### 1. New Edge Function: `send-application-confirmation`

```typescript
// Structure matching existing notification functions
interface ConfirmationRequest {
  org_id: string;
  applicant_name: string;
  applicant_phone: string;
  application_number: string;
}
```

**Key behaviors:**
- Use Exotel V2 API (same pattern as `send-esign-notifications`)
- Template payload structure:
```typescript
{
  whatsapp: {
    messages: [{
      from: whatsapp_source_number,
      to: formattedPhone,
      content: {
        type: "template",
        template: {
          name: "app_confirmation",
          language: { code: "en" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: applicantName },      // {{1}}
              { type: "text", text: applicationNumber }   // {{2}}
            ]
          }]
        }
      }
    }]
  }
}
```

### 2. Modify `submit-loan-application`

Add notification calls after successful application creation:

**For Referral Applications (after line 371):**
```typescript
// Send WhatsApp confirmation
try {
  await fetch(`${supabaseUrl}/functions/v1/send-application-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_id: formConfig.org_id,
      applicant_name: body.applicant.name,
      applicant_phone: body.applicant.phone,
      application_number: applicationNumber
    })
  });
} catch (notifyError) {
  console.log('[submit-loan-application] WhatsApp notification skipped:', notifyError);
}
```

**For Public Form Applications (after line 716):**
Same pattern using `body.personalDetails.fullName` and `body.personalDetails.mobile`

### 3. Message Logging

Store sent messages in `whatsapp_messages` table for:
- Chat history display
- Delivery status tracking via webhook callbacks

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/send-application-confirmation/index.ts` | **Create** - New notification edge function |
| `supabase/functions/submit-loan-application/index.ts` | **Modify** - Add notification triggers at lines 371 and 716 |

## Error Handling

- Non-blocking: Notification failures won't prevent application submission
- Graceful degradation: Missing WhatsApp settings simply skip notification
- Logging: All attempts logged for debugging

## Verification Steps

After implementation:
1. Submit a test application via referral link
2. Verify WhatsApp message received with correct name and application number
3. Check `whatsapp_messages` table for logged message
4. Submit via public form and verify same behavior
