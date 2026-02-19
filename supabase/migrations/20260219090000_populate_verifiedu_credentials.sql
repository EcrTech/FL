-- Populate VerifiedU API credentials in organization settings
-- These credentials are used by VerifiedU edge functions (PAN, Aadhaar, Bank verification)
-- The edge functions read these from the request body (passed by the frontend hooks)

UPDATE organizations
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'verifiedu_token', 'VgBFAFIASQBGAEkARQBEAFUAVABFAFMAVABJAE4ARwBKAFUATgBPAE8ATgAtADEANAAtAEoAYQBuAC0AMgAwADIANgA=',
  'verifiedu_company_id', 'VUTJ',
  'verifiedu_api_base_url', 'http://localdev.earlywages.in'
)
WHERE id = 'a31a6056-72c8-458a-9bd8-1c43e8360095';
