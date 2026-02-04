
# Fix Plan: WhatsApp Message Sending Issues

## Problem Summary

When sending WhatsApp follow-up messages from the chat dialog, messages fail silently. The logs reveal **three distinct issues**:

| Issue | Root Cause | Impact |
|-------|------------|--------|
| Foreign Key Violation | `ApplicationCard` and `ApplicantProfileCard` pass `loan_application.id` instead of `contact.id` | Database insert fails |
| Exotel API Rejection | Text message payload uses `text: "message"` instead of `text: { body: "message" }` | Exotel returns empty response |
| Silent Failure | Edge function returns `success: true` even when DB insert fails | UI shows no error |

---

## Detailed Analysis

### Issue 1: Wrong ID Being Passed to WhatsAppChatDialog

The `WhatsAppChatDialog` component expects a `contactId` prop that references the `contacts` table. However:

- **`ApplicationCard.tsx` (line 212)**: Passes `application.id` (loan_applications ID)
- **`ApplicantProfileCard.tsx` (line 569)**: Passes `applicationId` (loan_applications ID)

The `whatsapp_messages` table has a foreign key constraint:
```
whatsapp_messages_contact_id_fkey → contacts.id
```

This causes the database error:
```
Key is not present in table "contacts"
```

### Issue 2: Incorrect Exotel Text Message Payload Format

The edge function sends text messages with:
```typescript
// Current (incorrect)
content: {
  type: "text",
  text: messageContent  // string directly
}
```

Exotel V2 API requires:
```typescript
// Required format
content: {
  type: "text",
  text: { body: messageContent }  // nested object
}
```

This is why the Exotel raw response is empty - the API is rejecting the malformed payload silently.

### Issue 3: Success Returned Despite Failures

In `send-whatsapp-message/index.ts`, the function returns `success: true` even when:
- Exotel returns an empty response (line 247-267)
- Database insert fails (line 312-315)

---

## Implementation Plan

### Phase 1: Fix Exotel Text Message Payload

**File:** `supabase/functions/send-whatsapp-message/index.ts`

Update the text message payload structure (lines 213-226):

```typescript
// Before
content: {
  type: "text",
  text: messageContent
}

// After
content: {
  type: "text",
  text: { body: messageContent }
}
```

Also fix response parsing to extract `sid` from nested Exotel V2 response:

```typescript
const exotelSid = exotelResult.response?.whatsapp?.messages?.[0]?.data?.sid 
  || exotelResult.sid 
  || exotelResult.id;
```

### Phase 2: Fix Contact ID Resolution

**Approach A (Recommended):** Resolve the actual contact ID in the edge function using phone number

Modify `send-whatsapp-message/index.ts` to:
1. Accept `contactId` as optional
2. Look up or create contact from phone number if not provided
3. Use the resolved contact ID for database operations

This is more resilient since:
- It ensures the correct contact is always found
- Creates a contact if one doesn't exist for the phone number
- Works regardless of what the frontend passes

**Alternative Approach B:** Fix the calling components

Update these components to pass the correct contact ID:
- `src/components/LOS/Relationships/ApplicationCard.tsx`
- `src/components/LOS/ApplicantProfileCard.tsx`

This requires finding/fetching the contact associated with each loan application.

### Phase 3: Improve Error Handling

**File:** `supabase/functions/send-whatsapp-message/index.ts`

1. Check for empty Exotel response and treat as failure
2. If database insert fails, still return the Exotel message ID but indicate partial success
3. Return proper error structure so UI can display issues

### Phase 4: Update Frontend Error Handling (Optional)

**File:** `src/components/LOS/Relationships/WhatsAppChatDialog.tsx`

Improve error detection in `sendFollowUpMessage` to handle edge cases where the response looks successful but message wasn't stored.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-whatsapp-message/index.ts` | Fix text payload format, add contact resolution, improve error handling |
| `src/components/LOS/Relationships/ApplicationCard.tsx` | (Optional) Pass correct contact_id |
| `src/components/LOS/ApplicantProfileCard.tsx` | (Optional) Pass correct contact_id |

---

## Technical Details

### Exotel V2 Correct Payload Structure

```typescript
{
  whatsapp: {
    messages: [{
      from: "+91XXXXXXXXXX",
      to: "91XXXXXXXXXX",
      content: {
        type: "text",
        text: { 
          body: "Your message content here" 
        }
      }
    }]
  }
}
```

### Exotel V2 Response Structure

```typescript
{
  response: {
    whatsapp: {
      messages: [{
        data: {
          sid: "message_sid_here",
          from: "+91XXXXXXXXXX",
          to: "91XXXXXXXXXX"
        }
      }]
    }
  }
}
```

### Contact Resolution Logic

```typescript
// In edge function
async function resolveContactId(
  supabaseClient: any,
  phoneNumber: string,
  orgId: string,
  providedContactId?: string
): Promise<string> {
  // If valid contact ID provided, verify it exists
  if (providedContactId) {
    const { data: contact } = await supabaseClient
      .from('contacts')
      .select('id')
      .eq('id', providedContactId)
      .single();
    
    if (contact) return contact.id;
  }
  
  // Look up contact by phone number
  const { data: existingContact } = await supabaseClient
    .from('contacts')
    .select('id')
    .eq('phone', phoneNumber)
    .eq('org_id', orgId)
    .single();
  
  if (existingContact) return existingContact.id;
  
  // Create new contact if not found
  const { data: newContact } = await supabaseClient
    .from('contacts')
    .insert({
      phone: phoneNumber,
      org_id: orgId,
      first_name: phoneNumber, // Placeholder
      source: 'whatsapp'
    })
    .select('id')
    .single();
  
  return newContact?.id;
}
```

---

## Testing Checklist

- [ ] Send a follow-up text message and verify it appears in chat
- [ ] Verify message is stored in `whatsapp_messages` table with correct `contact_id`
- [ ] Verify Exotel actually receives the message (check their logs/webhook)
- [ ] Test error scenarios (invalid phone, network failure) show proper UI feedback
- [ ] Test conversation template still works correctly
