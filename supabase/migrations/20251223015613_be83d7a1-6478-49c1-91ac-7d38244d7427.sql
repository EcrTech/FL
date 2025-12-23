-- Add new Exotel columns to whatsapp_settings
ALTER TABLE public.whatsapp_settings 
  ADD COLUMN IF NOT EXISTS exotel_sid TEXT,
  ADD COLUMN IF NOT EXISTS exotel_api_key TEXT,
  ADD COLUMN IF NOT EXISTS exotel_api_token TEXT,
  ADD COLUMN IF NOT EXISTS exotel_subdomain TEXT DEFAULT 'api.exotel.com';

-- Rename gupshup_message_id to exotel_message_id in whatsapp_messages
ALTER TABLE public.whatsapp_messages 
  RENAME COLUMN gupshup_message_id TO exotel_message_id;

-- Drop old Gupshup columns from whatsapp_settings
ALTER TABLE public.whatsapp_settings 
  DROP COLUMN IF EXISTS gupshup_api_key,
  DROP COLUMN IF EXISTS app_name;