
# WhatsApp Incoming Message Notification System

## Problem
When you send a WhatsApp message to a customer and then navigate away (switch to another customer or page), there is no way to know if the first customer replied. The realtime subscription only works while the WhatsApp chat dialog is open. Once closed, incoming replies are silently stored in the database with no alert.

## Solution
Add two layers of awareness for incoming WhatsApp replies:

### 1. Database: Add `is_read` column to `whatsapp_messages`
- Add an `is_read` boolean column (default `false`) to the `whatsapp_messages` table
- Outbound messages default to `true` (you sent them, they're "read")
- Inbound messages default to `false` (unread until opened)

### 2. Database trigger: Auto-create a notification on inbound WhatsApp message
- Create a Postgres trigger on `whatsapp_messages` that fires on INSERT
- When `direction = 'inbound'`, insert a row into the `notifications` table with:
  - `title`: "New WhatsApp message"
  - `message`: truncated preview of `message_content`
  - `action_url`: link to the Communications page or the contact's profile
  - `entity_type`: "whatsapp_message"
  - `entity_id`: the message ID
- This leverages the existing `NotificationBell` component and `useNotifications` hook which already have realtime subscriptions -- so the bell badge updates instantly

### 3. Mark messages as read when chat is opened
**File: `src/components/LOS/Relationships/WhatsAppChatDialog.tsx`**
- When messages are fetched (dialog opens), update all inbound messages for that phone number to `is_read = true`
- This clears the unread state for that conversation

### 4. Show unread indicator on WhatsApp buttons
**Files that open WhatsAppChatDialog:**
- `src/components/LOS/ApplicantProfileCard.tsx` -- WhatsApp icon button on applicant cards
- `src/pages/CallingUploadLeads.tsx` -- WhatsApp action in lead lists
- `src/pages/CallingLeadDetail.tsx` -- WhatsApp button on lead detail

For each, add a small query to check if there are unread inbound WhatsApp messages for that contact's phone number, and show a dot/badge on the WhatsApp button if so.

### 5. Communications page integration
**File: `src/pages/Communications.tsx`**
- The existing `is_read` field in the conversation list view should now work for WhatsApp messages too since the column will exist
- No major changes needed if the view already reads from `whatsapp_messages.is_read`; if it uses a separate mapping, update to use the new column

## What Stays the Same
- The WhatsApp chat dialog UI and messaging flow
- The NotificationBell component (no code changes -- it already handles new notifications via realtime)
- The `useNotifications` hook (already has realtime subscription for new inserts)

## Technical Summary

| Change | Type | Details |
|--------|------|---------|
| Add `is_read` to `whatsapp_messages` | DB migration | Boolean column, default false for inbound, true for outbound |
| Create notification trigger | DB migration | Postgres function + trigger on INSERT |
| Mark as read on dialog open | Code change | `WhatsAppChatDialog.tsx` |
| Unread dot on WhatsApp buttons | Code change | `ApplicantProfileCard.tsx`, `CallingUploadLeads.tsx`, `CallingLeadDetail.tsx` |
| Communications page | Code change | Ensure `is_read` is used from the new column |
