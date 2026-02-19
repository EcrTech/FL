-- Clear recent OTPs to allow testing
DELETE FROM public.public_otp_verifications
WHERE identifier = '+917738919680'
  AND created_at > now() - interval '1 hour';
