
-- 1. Replace SELECT policy on whatsapp_messages
DROP POLICY IF EXISTS "Users can view messages in their org" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can view own or assigned messages" ON public.whatsapp_messages;

CREATE POLICY "Users can view own or assigned messages"
ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (
  org_id = get_user_org_id(auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
    OR sent_by = auth.uid()
    OR (direction = 'inbound' AND contact_id IN (
      SELECT id FROM public.contacts WHERE assigned_to = auth.uid()
    ))
  )
);

-- 2. Replace SELECT policy on email_conversations
DROP POLICY IF EXISTS "Users can view email conversations in their org" ON public.email_conversations;
DROP POLICY IF EXISTS "Users can view own or assigned email conversations" ON public.email_conversations;

CREATE POLICY "Users can view own or assigned email conversations"
ON public.email_conversations
FOR SELECT TO authenticated
USING (
  org_id = get_user_org_id(auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
    OR sent_by = auth.uid()
    OR (direction = 'inbound' AND contact_id IN (
      SELECT id FROM public.contacts WHERE assigned_to = auth.uid()
    ))
  )
);

-- 3. Replace SELECT policy on sms_messages (no direction column)
DROP POLICY IF EXISTS "Users can view SMS messages in their org" ON public.sms_messages;
DROP POLICY IF EXISTS "Users can view own or assigned SMS messages" ON public.sms_messages;

CREATE POLICY "Users can view own or assigned SMS messages"
ON public.sms_messages
FOR SELECT TO authenticated
USING (
  org_id = get_user_org_id(auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
    OR sent_by = auth.uid()
    OR contact_id IN (
      SELECT id FROM public.contacts WHERE assigned_to = auth.uid()
    )
  )
);

-- 4. Update get_unified_inbox to apply same visibility rules
CREATE OR REPLACE FUNCTION public.get_unified_inbox(p_org_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, conversation_id text, contact_id uuid, channel text, direction text, sender_name text, preview text, is_read boolean, sent_at timestamp with time zone, contact_name text, phone_number text, email_address text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  RETURN QUERY
  SELECT 
    wm.id,
    wm.conversation_id::TEXT,
    wm.contact_id,
    'whatsapp'::TEXT as channel,
    wm.direction,
    wm.sender_name,
    LEFT(wm.message_content, 100) as preview,
    COALESCE(wm.read_at IS NOT NULL, FALSE) as is_read,
    wm.sent_at,
    COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), wm.sender_name) as contact_name,
    wm.phone_number,
    NULL::TEXT as email_address
  FROM whatsapp_messages wm
  LEFT JOIN contacts c ON c.id = wm.contact_id
  WHERE wm.org_id = p_org_id
    AND (v_is_admin OR wm.sent_by = auth.uid() OR c.assigned_to = auth.uid())
  
  UNION ALL
  
  SELECT 
    ec.id,
    ec.conversation_id::TEXT,
    ec.contact_id,
    'email'::TEXT as channel,
    ec.direction,
    ec.from_name as sender_name,
    LEFT(ec.subject || ': ' || ec.email_content, 100) as preview,
    ec.is_read,
    ec.sent_at,
    COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), ec.from_name) as contact_name,
    NULL::TEXT as phone_number,
    ec.from_email as email_address
  FROM email_conversations ec
  LEFT JOIN contacts c ON c.id = ec.contact_id
  WHERE ec.org_id = p_org_id
    AND (v_is_admin OR ec.sent_by = auth.uid() OR c.assigned_to = auth.uid())
  
  ORDER BY sent_at DESC
  LIMIT p_limit;
END;
$function$;
