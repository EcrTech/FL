-- Add Nupay E-Sign specific columns to document_esign_requests table
ALTER TABLE public.document_esign_requests 
ADD COLUMN IF NOT EXISTS nupay_docket_id TEXT,
ADD COLUMN IF NOT EXISTS nupay_document_id TEXT,
ADD COLUMN IF NOT EXISTS nupay_ref_no TEXT,
ADD COLUMN IF NOT EXISTS signer_url TEXT,
ADD COLUMN IF NOT EXISTS signer_sequence INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS esign_response JSONB;

-- Create index for faster lookups by Nupay document ID
CREATE INDEX IF NOT EXISTS idx_document_esign_requests_nupay_document_id 
ON public.document_esign_requests(nupay_document_id) 
WHERE nupay_document_id IS NOT NULL;

-- Create index for reference number lookups
CREATE INDEX IF NOT EXISTS idx_document_esign_requests_nupay_ref_no 
ON public.document_esign_requests(nupay_ref_no) 
WHERE nupay_ref_no IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.document_esign_requests.nupay_docket_id IS 'Nupay unique document tracking ID from signRequest response';
COMMENT ON COLUMN public.document_esign_requests.nupay_document_id IS 'Nupay document ID for status queries';
COMMENT ON COLUMN public.document_esign_requests.nupay_ref_no IS 'Our reference number sent to Nupay: ESIGN-{app_number}-{timestamp}';
COMMENT ON COLUMN public.document_esign_requests.signer_url IS 'URL for signer to complete Aadhaar-based e-signing';
COMMENT ON COLUMN public.document_esign_requests.signer_sequence IS 'Order of signing when multiple signers (1-4)';
COMMENT ON COLUMN public.document_esign_requests.esign_response IS 'Full API response from Nupay for debugging';