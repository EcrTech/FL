-- Create document_esign_requests table for tracking eSign requests
CREATE TABLE public.document_esign_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.loan_generated_documents(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  
  -- Signer info
  signer_name TEXT NOT NULL,
  signer_phone TEXT,
  signer_email TEXT,
  signer_aadhaar_last4 TEXT,
  
  -- Token for secure access
  access_token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Aadhaar eSign data
  aadhaar_request_id TEXT,
  signed_at TIMESTAMPTZ,
  signed_from_ip TEXT,
  signed_document_path TEXT,
  
  -- Audit trail
  audit_log JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  notification_channel TEXT,
  notification_sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_esign_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view esign requests for their org"
  ON public.document_esign_requests FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create esign requests for their org"  
  ON public.document_esign_requests FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update esign requests for their org"
  ON public.document_esign_requests FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Create index for token lookups
CREATE INDEX idx_esign_requests_access_token ON public.document_esign_requests(access_token);
CREATE INDEX idx_esign_requests_application_id ON public.document_esign_requests(application_id);
CREATE INDEX idx_esign_requests_status ON public.document_esign_requests(status);

-- Add customer_signed column to loan_generated_documents if not exists
ALTER TABLE public.loan_generated_documents 
ADD COLUMN IF NOT EXISTS customer_signed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signed_document_path TEXT;