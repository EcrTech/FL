

## WhatsApp Chat Feature - Auto-Send "conversation" Template

This plan implements a WhatsApp chat feature where clicking the WhatsApp button on Customer/Application cards automatically sends the "conversation" template message and opens a real-time chat window to view replies.

---

### Template Details

The "conversation" template will be sent automatically when the WhatsApp button is clicked:

**Template Name:** `conversation`
**Language:** English (`en`)
**Body:** 
```
Hello

I have a few clarifications to seek about your application. Are you available now?

team PaisaaSaarthi
```

This template has no variables (static content), making the auto-send straightforward.

---

### Implementation Overview

```text
+---------------------------+
|  User clicks WhatsApp     |
|  button on Customer or    |
|  Application Card         |
+------------+--------------+
             |
             v
+---------------------------+
|  WhatsAppChatDialog       |
|  opens                    |
+------------+--------------+
             |
             v
+---------------------------+
|  Checks for existing      |
|  conversation history     |
+------------+--------------+
             |
    +--------+--------+
    |                 |
    v                 v
No messages        Has messages
    |                 |
    v                 v
Auto-send         Show history
"conversation"    (skip auto-send)
template              
    |                 |
    +--------+--------+
             |
             v
+---------------------------+
|  Real-time subscription   |
|  for incoming replies     |
+---------------------------+
```

---

### Component Architecture

**New Files:**

| File | Purpose |
|------|---------|
| `src/components/LOS/Relationships/WhatsAppChatDialog.tsx` | Chat dialog with auto-send and real-time updates |

**Modified Files:**

| File | Changes |
|------|---------|
| `src/components/LOS/Relationships/CustomerCard.tsx` | Add WhatsApp button that triggers chat dialog |
| `src/components/LOS/Relationships/ApplicationCard.tsx` | Add WhatsApp button that triggers chat dialog |
| `supabase/functions/send-whatsapp-message/index.ts` | Add support for hardcoded template names (like "conversation") |

---

### Database Changes

Enable real-time for the `whatsapp_messages` table so the chat dialog receives instant updates when applicants reply:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
```

---

### WhatsAppChatDialog Component

The dialog will:

1. **On Open:**
   - Fetch existing messages for the phone number from `whatsapp_messages`
   - If no previous messages exist, automatically trigger the "conversation" template
   - Subscribe to real-time updates

2. **UI Elements:**
   - Header showing applicant name and phone number
   - Scrollable message history with WhatsApp-style bubbles (green for sent, gray for received)
   - Status indicators (sent, delivered, read, failed)
   - Input area for sending follow-up messages (enabled after receiving a reply - within 24-hour session window)

3. **Auto-Send Logic:**
   ```typescript
   // On dialog open
   const existingMessages = await fetchMessages(phoneNumber);
   if (existingMessages.length === 0) {
     await sendConversationTemplate();
   }
   ```

---

### Edge Function Updates

Update `send-whatsapp-message` to support template-based sending with Exotel's format:

```typescript
// New payload structure for "conversation" template
const payload = {
  whatsapp: {
    messages: [{
      from: whatsapp_source_number,
      to: formattedPhone,
      content: {
        type: "template",
        template: {
          name: "conversation",
          language: { code: "en" },
          components: [] // No variables needed
        }
      }
    }]
  }
};
```

A new optional parameter `templateName` will be added to support hardcoded template names directly (vs template IDs from the database).

---

### CustomerCard Changes

Add WhatsApp button to the actions column:

```typescript
// New state
const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);

// Button added to actions
<Button
  variant="ghost"
  size="icon"
  onClick={() => setShowWhatsAppChat(true)}
  title="WhatsApp Chat"
>
  <MessageSquare className="h-4 w-4 text-green-600" />
</Button>

// Dialog component
<WhatsAppChatDialog
  open={showWhatsAppChat}
  onOpenChange={setShowWhatsAppChat}
  contactId={customer.contactId}
  contactName={customer.name}
  phoneNumber={customer.mobile}
/>
```

---

### ApplicationCard Changes

Similar WhatsApp button added to the view actions area, using the applicant's phone number and name from the application data.

---

### Real-time Subscription

The chat dialog will subscribe to changes using phone number as the conversation identifier:

```typescript
const channel = supabase
  .channel(`whatsapp-chat-${phoneNumber}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'whatsapp_messages',
      filter: `phone_number=eq.${formattedPhone}`,
    },
    (payload) => {
      if (payload.eventType === 'INSERT') {
        setMessages(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setMessages(prev => 
          prev.map(m => m.id === payload.new.id ? payload.new : m)
        );
      }
    }
  )
  .subscribe();
```

---

### Message Flow

**Outbound (Auto-send on open):**
1. Dialog opens and checks message history
2. If empty, calls edge function with `templateName: "conversation"`
3. Edge function sends via Exotel and logs to `whatsapp_messages`
4. Message appears in chat with "sending" status
5. Webhook updates status to "delivered"/"read"

**Inbound (Applicant replies):**
1. Exotel sends webhook to `whatsapp-webhook` function
2. Function stores message in `whatsapp_messages` with `direction: "inbound"`
3. Real-time subscription triggers UI update
4. New message appears in chat dialog

---

### Technical Details

**Edge Function Request Interface:**
```typescript
interface SendMessageRequest {
  contactId: string;
  phoneNumber: string;
  templateId?: string;           // Existing: from database
  templateName?: string;         // New: hardcoded name like "conversation"
  templateVariables?: Record<string, string>;
  message?: string;
}
```

**Chat Message Interface:**
```typescript
interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  message_content: string;
  sent_at: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  sender_name?: string;
}
```

---

### Dependencies

Uses existing installed packages:
- `@supabase/supabase-js` for real-time subscriptions
- `lucide-react` for icons (MessageSquare)
- `date-fns` for timestamp formatting

---

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No prior conversation | Auto-send template immediately |
| Existing messages | Show history, no auto-send |
| Send failure | Show error toast, allow retry |
| User not logged in | Disable WhatsApp button or show auth prompt |
| Invalid phone number | Validation before sending |
| Webhook delay | Optimistic UI with status indicators |

---

### Summary of Changes

1. **Database Migration:** Enable realtime on `whatsapp_messages`
2. **New Component:** `WhatsAppChatDialog.tsx` (approx. 250 lines)
3. **Modified Components:**
   - `CustomerCard.tsx` - Add button + dialog
   - `ApplicationCard.tsx` - Add button + dialog
4. **Edge Function Update:** `send-whatsapp-message` - Add templateName support for Exotel format

