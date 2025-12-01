-- Remove API Keys backend infrastructure
-- This was created for a different project and is no longer needed

-- Drop tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS public.api_key_usage_logs CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;

-- Drop the generate_api_key function
DROP FUNCTION IF EXISTS public.generate_api_key() CASCADE;