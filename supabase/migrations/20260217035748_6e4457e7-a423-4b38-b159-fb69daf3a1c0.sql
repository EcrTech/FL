
-- 1. Add is_read column to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN is_read boolean NOT NULL DEFAULT false;

-- 2. Set existing outbound messages as read
UPDATE public.whatsapp_messages SET is_read = true WHERE direction = 'outbound';

-- 3. Create trigger function to auto-create notification on inbound WhatsApp message
CREATE OR REPLACE FUNCTION public.notify_inbound_whatsapp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    INSERT INTO public.notifications (
      org_id,
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      is_read
    )
    SELECT 
      NEW.org_id,
      NEW.sent_by,
      'whatsapp_message',
      'New WhatsApp message',
      LEFT(COALESCE(NEW.message_content, 'Media message'), 100),
      'whatsapp_message',
      NEW.id,
      '/communications',
      false
    WHERE NEW.sent_by IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create the trigger
CREATE TRIGGER trg_whatsapp_inbound_notification
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_inbound_whatsapp();
