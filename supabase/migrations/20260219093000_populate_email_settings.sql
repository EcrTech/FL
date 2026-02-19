-- Populate email settings for in-sync.co.in (already verified on Resend)
INSERT INTO public.email_settings (
  org_id,
  sending_domain,
  resend_domain_id,
  verification_status,
  dns_records,
  verified_at,
  is_active
) VALUES (
  'a31a6056-72c8-458a-9bd8-1c43e8360095',
  'in-sync.co.in',
  'e9b92561-007f-4090-8386-16791d29bee3',
  'verified',
  '[
    {"record":"DKIM","name":"resend._domainkey","value":"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDH9IZOMkUOgLtA+8rh6NP8yWohqQ8tBPd6B4XRZ8BKlDyOhWwejhDZOEsBUiHGmnKy8S1E9jtxtZRhDD9dT0s3TaD3tnFSqPuVW9ttXQFsTJB6H5ihJjLBXQ7UUW2lNUITuRzHpzj6Lc4zazb5LzyJHPFKI9dpw04W+P/Km5It8wIDAQAB","type":"TXT","status":"verified","ttl":"Auto"},
    {"record":"SPF","name":"send","type":"MX","ttl":"Auto","status":"verified","value":"feedback-smtp.us-east-1.amazonses.com","priority":10},
    {"record":"SPF","name":"send","value":"v=spf1 include:amazonses.com ~all","type":"TXT","ttl":"Auto","status":"verified"}
  ]'::jsonb,
  NOW(),
  true
)
ON CONFLICT (org_id) DO UPDATE SET
  sending_domain = EXCLUDED.sending_domain,
  resend_domain_id = EXCLUDED.resend_domain_id,
  verification_status = EXCLUDED.verification_status,
  dns_records = EXCLUDED.dns_records,
  verified_at = EXCLUDED.verified_at,
  is_active = EXCLUDED.is_active;
