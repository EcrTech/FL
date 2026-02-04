-- Add separate E-Sign API endpoint column to nupay_config
ALTER TABLE nupay_config 
ADD COLUMN esign_api_endpoint text;

-- Add comment explaining the column
COMMENT ON COLUMN nupay_config.esign_api_endpoint IS 'Separate API endpoint for E-Sign service (e.g., https://esign.nupaybiz.com). If null, falls back to api_endpoint.';