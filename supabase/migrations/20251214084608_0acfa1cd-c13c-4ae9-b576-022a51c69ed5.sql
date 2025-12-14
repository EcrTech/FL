-- Create table for public OTP verifications (unauthenticated users)
CREATE TABLE public.public_otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'phone')),
  otp_code TEXT NOT NULL,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  verified_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for lookups
CREATE INDEX idx_public_otp_identifier ON public.public_otp_verifications(identifier, identifier_type);
CREATE INDEX idx_public_otp_session ON public.public_otp_verifications(session_id);
CREATE INDEX idx_public_otp_expires ON public.public_otp_verifications(expires_at);

-- Enable RLS
ALTER TABLE public.public_otp_verifications ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for sending OTP)
CREATE POLICY "Allow public insert for OTP"
ON public.public_otp_verifications
FOR INSERT
WITH CHECK (true);

-- Allow public update for verification attempts
CREATE POLICY "Allow public update for OTP verification"
ON public.public_otp_verifications
FOR UPDATE
USING (true);

-- Allow public select for verification
CREATE POLICY "Allow public select for OTP"
ON public.public_otp_verifications
FOR SELECT
USING (true);

-- Function to cleanup expired public OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_public_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public_otp_verifications WHERE expires_at < NOW() AND verified_at IS NULL;
END;
$$;