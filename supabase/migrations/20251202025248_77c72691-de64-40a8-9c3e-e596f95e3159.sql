-- Create loan_application_forms table for managing public form configurations
CREATE TABLE public.loan_application_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL DEFAULT 'personal_loan',
  is_active BOOLEAN DEFAULT true,
  required_documents JSONB DEFAULT '["pan_card", "aadhaar_card", "salary_slip", "bank_statement"]'::jsonb,
  form_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add geolocation and source tracking columns to loan_applications
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS geolocation_accuracy DECIMAL,
ADD COLUMN IF NOT EXISTS submitted_from_ip TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'agent',
ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES public.loan_application_forms(id);

-- Enable RLS on loan_application_forms
ALTER TABLE public.loan_application_forms ENABLE ROW LEVEL SECURITY;

-- Public can read active forms (no auth required)
CREATE POLICY "Anyone can view active loan forms"
ON public.loan_application_forms
FOR SELECT
USING (is_active = true);

-- Org users can manage their forms
CREATE POLICY "Org users can manage their loan forms"
ON public.loan_application_forms
FOR ALL
USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Create storage bucket for loan documents (public uploads via edge function)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-documents',
  'loan-documents', 
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for authenticated users to read their org's documents
CREATE POLICY "Org users can view loan documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- Service role can upload (handled by edge function with service key)
CREATE POLICY "Service role can upload loan documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'loan-documents');

-- Create index for slug lookups
CREATE INDEX idx_loan_application_forms_slug ON public.loan_application_forms(slug);
CREATE INDEX idx_loan_application_forms_org_active ON public.loan_application_forms(org_id, is_active);

-- Add trigger for updated_at
CREATE TRIGGER update_loan_application_forms_updated_at
BEFORE UPDATE ON public.loan_application_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default forms for existing organizations
INSERT INTO public.loan_application_forms (org_id, slug, name, description, product_type)
SELECT 
  id,
  'personal-loan',
  'Personal Loan Application',
  'Apply for a personal loan with competitive interest rates',
  'personal_loan'
FROM public.organizations
ON CONFLICT DO NOTHING;