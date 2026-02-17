
# Restrict Chat/Message Visibility to Own Messages + Admin

## Problem
Currently, all WhatsApp messages, email conversations, and SMS messages are visible to every member in the organization. The RLS policies only check `org_id`, meaning any team member can see conversations initiated by other members. There is no chat privacy.

## Solution
Update RLS policies on all three messaging tables and the `get_unified_inbox` database function so that:
- **Regular members** see only messages they sent (`sent_by = auth.uid()`) or messages from contacts assigned to them
- **Admins and Super Admins** see all messages in the org (for oversight)

## Changes

### 1. Database Migration -- Update RLS Policies

**Tables affected:** `whatsapp_messages`, `email_conversations`, `sms_messages`

For each table, drop the existing SELECT policy and replace it with one that checks:
- User is an admin/super_admin in the org (full access), OR
- The message was sent by the current user (`sent_by = auth.uid()`), OR
- The message is inbound and the linked contact is assigned to the current user

This uses the existing `has_role` pattern and `get_visible_user_ids()` function already used elsewhere in the project.

### 2. Database Migration -- Update `get_unified_inbox` Function

The `get_unified_inbox` RPC function runs with its own query logic. It currently filters only by `org_id`. Update it to also apply the same visibility rules:
- If the calling user is admin/super_admin: show all org messages (current behavior)
- Otherwise: filter to messages where `sent_by = auth.uid()` or the contact is assigned to the user

### 3. No Frontend Changes Required

The Communications page and WhatsApp chat dialogs already query through the same tables and RPC function. Once the database-level restrictions are in place, the UI will automatically show only the permitted messages.

## Technical Details

### RLS Policy Pattern (applied to all 3 tables)

```sql
-- Example for whatsapp_messages (same pattern for email_conversations, sms_messages)
DROP POLICY IF EXISTS "Users can view messages in their org" ON public.whatsapp_messages;

CREATE POLICY "Users can view own or assigned messages"
ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (
  org_id = get_user_org_id(auth.uid())
  AND (
    -- Admins see everything in org
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
    OR
    -- User sent this message
    sent_by = auth.uid()
    OR
    -- Inbound message for a contact assigned to this user
    (direction = 'inbound' AND contact_id IN (
      SELECT id FROM public.contacts
      WHERE assigned_to = auth.uid()
    ))
  )
);
```

### Updated `get_unified_inbox` Function
Add a role check at the top of the function. If the caller is not admin, add `AND (wm.sent_by = auth.uid() OR c.assigned_to = auth.uid())` filters to both UNION branches.

| Change | Type | Scope |
|--------|------|-------|
| RLS on `whatsapp_messages` | DB migration | Replace SELECT policy |
| RLS on `email_conversations` | DB migration | Replace SELECT policy |
| RLS on `sms_messages` | DB migration | Replace SELECT policy |
| Update `get_unified_inbox` | DB migration | Add user-level filtering |
