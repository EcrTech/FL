
# Fix Plan: WhatsApp Webhook to Handle Exotel's Nested Payload Format

## Problem Summary
The `whatsapp-webhook` edge function is receiving WhatsApp responses from Exotel, but rejecting them all because it expects a flat payload structure while Exotel sends a nested structure.

---

## Current vs Expected Payload Formats

### What the code expects (flat):
```json
{
  "sid": "message_id",
  "from": "+919158455686",
  "direction": "inbound",
  "body": "Hello"
}
```

### What Exotel actually sends (nested):
```json
{
  "whatsapp": {
    "messages": [
      {
        "callback_type": "incoming_message",
        "sid": "c5d40b17527aaf93b5ba0905287b1a24",
        "from": "+919158455686",
        "to": "+919211514326",
        "profile_name": "Aman",
        "content": {
          "type": "text",
          "text": { "body": "Hello" }
        }
      }
    ]
  }
}
```

---

## Types of Callbacks Being Missed

| Callback Type | Description | Data Location |
|---------------|-------------|---------------|
| `incoming_message` (text) | Customer sends text | `content.text.body` |
| `incoming_message` (button) | Customer clicks quick-reply button | `content.button.text` |
| `dlr` (Delivery Report) | Message delivered/seen | `exo_status_code`, `exo_detailed_status` |

---

## Implementation Changes

### File: `supabase/functions/whatsapp-webhook/index.ts`

1. **Update Interface Definitions** - Add new interfaces for nested Exotel format:
   ```typescript
   interface ExotelNestedMessage {
     callback_type: 'incoming_message' | 'dlr';
     sid: string;
     from?: string;
     to?: string;
     profile_name?: string;
     timestamp?: string;
     content?: {
       type: 'text' | 'button';
       text?: { body: string };
       button?: { payload: string; text: string };
     };
     exo_status_code?: number;
     exo_detailed_status?: string;
     description?: string;
   }
   
   interface ExotelNestedPayload {
     whatsapp: {
       messages: ExotelNestedMessage[];
     };
   }
   ```

2. **Add Payload Detection Function** - Detect and normalize both formats:
   ```typescript
   function parseExotelPayload(payload: any): {
     type: 'inbound' | 'dlr' | 'unknown';
     message: ExotelNestedMessage | null;
   } {
     // Check for nested format
     if (payload?.whatsapp?.messages?.[0]) {
       const msg = payload.whatsapp.messages[0];
       const type = msg.callback_type === 'incoming_message' ? 'inbound' : 
                    msg.callback_type === 'dlr' ? 'dlr' : 'unknown';
       return { type, message: msg };
     }
     
     // Legacy flat format fallback
     if (payload?.sid || payload?.id) {
       return {
         type: payload.direction === 'inbound' ? 'inbound' : 'dlr',
         message: payload
       };
     }
     
     return { type: 'unknown', message: null };
   }
   ```

3. **Update Validation Function** - Accept both formats:
   ```typescript
   function validateWebhookPayload(payload: any): boolean {
     // Accept nested Exotel format
     if (payload?.whatsapp?.messages?.length > 0) {
       return true;
     }
     // Accept legacy flat format
     return (
       payload &&
       (typeof payload.sid === 'string' || typeof payload.id === 'string') &&
       (typeof payload.to === 'string' || typeof payload.from === 'string')
     );
   }
   ```

4. **Handle Inbound Messages** - Extract content from nested structure:
   ```typescript
   // For text messages
   const messageBody = msg.content?.text?.body || '';
   
   // For button clicks (quick replies)
   const buttonResponse = msg.content?.button?.text || '';
   
   // Combined content
   const messageContent = messageBody || buttonResponse;
   ```

5. **Handle Delivery Reports (DLR)** - Map Exotel status codes:
   ```typescript
   const STATUS_MAP: Record<number, string> = {
     30001: 'sent',        // EX_MESSAGE_SENT
     30002: 'delivered',   // EX_MESSAGE_DELIVERED
     30003: 'read',        // EX_MESSAGE_SEEN
     30004: 'failed',      // EX_MESSAGE_FAILED
   };
   
   const status = STATUS_MAP[msg.exo_status_code] || 'unknown';
   ```

6. **Use Profile Name for Contact Creation** - Exotel provides `profile_name`:
   ```typescript
   // When creating new contacts from inbound messages
   const firstName = msg.profile_name || phoneNumber;
   ```

---

## Updated Processing Flow

```text
1. Receive webhook POST
2. Parse JSON payload
3. Detect format (nested vs flat)
4. For nested format:
   a. Extract message from whatsapp.messages[0]
   b. Check callback_type
   c. If 'incoming_message':
      - Extract text from content.text.body OR content.button.text
      - Find/create contact using profile_name
      - Store message with direction='inbound'
   d. If 'dlr':
      - Map exo_status_code to status string
      - Update existing message status
5. Return success
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/whatsapp-webhook/index.ts` | Full refactor to handle nested payload format |

---

## Testing Plan

After deployment:
1. Send a WhatsApp template message to a test number
2. Have the recipient reply with text - verify it appears in chat
3. Have the recipient click a quick-reply button - verify button response recorded
4. Check that delivery/read receipts update message status

---

## Additional Notes

- The code will support **both** payload formats for backward compatibility
- Button responses (quick-reply clicks) will be stored as regular inbound messages
- The `profile_name` field will be used for better contact names instead of phone numbers
