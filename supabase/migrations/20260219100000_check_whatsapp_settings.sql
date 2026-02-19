-- Diagnostic: check whatsapp_settings has data
-- This is a no-op migration, just verifying data exists
DO $$
DECLARE
  v_count int;
  v_sid text;
  v_subdomain text;
  v_waba text;
  v_source text;
  v_has_key boolean;
  v_has_token boolean;
BEGIN
  SELECT count(*) INTO v_count FROM public.whatsapp_settings
  WHERE org_id = 'a31a6056-72c8-458a-9bd8-1c43e8360095';

  IF v_count = 0 THEN
    RAISE NOTICE 'NO whatsapp_settings found for org';
    RETURN;
  END IF;

  SELECT exotel_sid, exotel_subdomain, waba_id, whatsapp_source_number,
         (exotel_api_key IS NOT NULL AND exotel_api_key != ''),
         (exotel_api_token IS NOT NULL AND exotel_api_token != '')
  INTO v_sid, v_subdomain, v_waba, v_source, v_has_key, v_has_token
  FROM public.whatsapp_settings
  WHERE org_id = 'a31a6056-72c8-458a-9bd8-1c43e8360095';

  RAISE NOTICE 'SID: %, Subdomain: %, WABA: %, Source: %, HasKey: %, HasToken: %',
    v_sid, v_subdomain, v_waba, v_source, v_has_key, v_has_token;
END $$;
