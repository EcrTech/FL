-- Add waba_id column to whatsapp_settings for Exotel template submission
ALTER TABLE public.whatsapp_settings 
ADD COLUMN IF NOT EXISTS waba_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_settings.waba_id IS 'WhatsApp Business Account ID required for Exotel template submission';