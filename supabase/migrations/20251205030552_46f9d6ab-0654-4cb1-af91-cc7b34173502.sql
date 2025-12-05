-- Create OTP verification table
CREATE TABLE public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('mobile', 'email')),
  target TEXT NOT NULL, -- phone number or email
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add verification status columns to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view OTPs in their org" 
ON public.otp_verifications 
FOR SELECT 
USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can create OTPs in their org" 
ON public.otp_verifications 
FOR INSERT 
WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update OTPs in their org" 
ON public.otp_verifications 
FOR UPDATE 
USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role has full access to OTPs" 
ON public.otp_verifications 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_otp_verifications_target ON public.otp_verifications(target, verification_type);
CREATE INDEX idx_otp_verifications_contact ON public.otp_verifications(contact_id);

-- Function to clean up expired OTPs (can be called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM otp_verifications WHERE expires_at < NOW() AND verified_at IS NULL;
END;
$$;