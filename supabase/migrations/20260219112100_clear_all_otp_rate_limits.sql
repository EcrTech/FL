DELETE FROM public.public_otp_verifications
WHERE created_at > now() - interval '1 hour';
