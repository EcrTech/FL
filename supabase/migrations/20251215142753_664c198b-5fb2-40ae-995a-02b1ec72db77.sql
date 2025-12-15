-- Create table to store generated loan documents
CREATE TABLE public.loan_generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  sanction_id UUID REFERENCES public.loan_sanctions(id),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('kfs', 'sanction_letter', 'loan_agreement', 'dpn')),
  document_number TEXT NOT NULL,
  file_path TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),
  customer_signed BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  signature_data JSONB,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'signed', 'expired', 'superseded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate documents
CREATE UNIQUE INDEX idx_loan_docs_unique ON public.loan_generated_documents(loan_application_id, document_type, sanction_id) WHERE sanction_id IS NOT NULL;

-- Create table for organization loan settings
CREATE TABLE public.organization_loan_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) UNIQUE,
  company_name TEXT DEFAULT 'Paisaa Saarthi',
  company_address TEXT,
  company_cin TEXT,
  company_phone TEXT,
  registered_office_address TEXT,
  grievance_email TEXT,
  grievance_phone TEXT,
  jurisdiction TEXT DEFAULT 'Mumbai',
  gst_on_processing_fee NUMERIC DEFAULT 18,
  foreclosure_rate NUMERIC DEFAULT 4,
  insurance_charges NUMERIC DEFAULT 0,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.loan_generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_loan_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for loan_generated_documents
CREATE POLICY "Users can view their org documents" ON public.loan_generated_documents
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their org documents" ON public.loan_generated_documents
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their org documents" ON public.loan_generated_documents
  FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- RLS policies for organization_loan_settings
CREATE POLICY "Users can view their org settings" ON public.organization_loan_settings
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their org settings" ON public.organization_loan_settings
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their org settings" ON public.organization_loan_settings
  FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_loan_docs_application ON public.loan_generated_documents(loan_application_id);
CREATE INDEX idx_loan_docs_sanction ON public.loan_generated_documents(sanction_id);
CREATE INDEX idx_loan_docs_org ON public.loan_generated_documents(org_id);

-- Create trigger for updated_at
CREATE TRIGGER update_loan_generated_documents_updated_at
  BEFORE UPDATE ON public.loan_generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_loan_settings_updated_at
  BEFORE UPDATE ON public.organization_loan_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();