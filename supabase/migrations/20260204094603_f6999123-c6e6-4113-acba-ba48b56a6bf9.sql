-- Add separate eSign API key column for organizations that need different credentials
ALTER TABLE nupay_config 
ADD COLUMN IF NOT EXISTS esign_api_key TEXT;

COMMENT ON COLUMN nupay_config.esign_api_key IS 'Separate API key for eSign service if required by Nupay (falls back to api_key if null)';