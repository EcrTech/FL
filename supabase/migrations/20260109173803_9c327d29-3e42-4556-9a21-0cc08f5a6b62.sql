-- Create table for RBL Bank API configuration per organization
CREATE TABLE public.rbl_bank_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('uat', 'production')),
  api_endpoint TEXT NOT NULL,
  client_id TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, environment)
);

-- Create table for payment transactions (all RBL API calls)
CREATE TABLE public.rbl_payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_application_id UUID REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  disbursement_id UUID REFERENCES public.loan_disbursements(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('disbursement', 'collection', 'penny_drop', 'mandate_register', 'mandate_debit', 'status_check')),
  payment_mode TEXT CHECK (payment_mode IN ('NEFT', 'RTGS', 'IMPS', 'UPI', 'NACH')),
  amount NUMERIC(15, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'timeout')),
  reference_id TEXT NOT NULL,
  utr_number TEXT,
  beneficiary_name TEXT,
  beneficiary_account TEXT,
  beneficiary_ifsc TEXT,
  request_payload JSONB,
  response_payload JSONB,
  callback_data JSONB,
  error_message TEXT,
  initiated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for NACH E-Mandates
CREATE TABLE public.rbl_nach_mandates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  mandate_id TEXT,
  umrn TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'active', 'rejected', 'cancelled', 'expired')),
  max_amount NUMERIC(15, 2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'half_yearly', 'yearly', 'as_presented')),
  start_date DATE NOT NULL,
  end_date DATE,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT,
  request_payload JSONB,
  response_payload JSONB,
  rejection_reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.rbl_bank_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbl_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbl_nach_mandates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rbl_bank_config
CREATE POLICY "Users can view their org RBL config" ON public.rbl_bank_config
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage RBL config" ON public.rbl_bank_config
  FOR ALL USING (
    org_id IN (
      SELECT p.org_id FROM public.profiles p 
      JOIN public.designations d ON p.designation_id = d.id 
      WHERE p.id = auth.uid() AND d.role = 'admin'
    )
  );

-- RLS Policies for rbl_payment_transactions
CREATE POLICY "Users can view their org transactions" ON public.rbl_payment_transactions
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create transactions for their org" ON public.rbl_payment_transactions
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their org transactions" ON public.rbl_payment_transactions
  FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- RLS Policies for rbl_nach_mandates
CREATE POLICY "Users can view their org mandates" ON public.rbl_nach_mandates
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their org mandates" ON public.rbl_nach_mandates
  FOR ALL USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_rbl_payment_transactions_org_id ON public.rbl_payment_transactions(org_id);
CREATE INDEX idx_rbl_payment_transactions_loan_id ON public.rbl_payment_transactions(loan_application_id);
CREATE INDEX idx_rbl_payment_transactions_status ON public.rbl_payment_transactions(status);
CREATE INDEX idx_rbl_payment_transactions_reference_id ON public.rbl_payment_transactions(reference_id);
CREATE INDEX idx_rbl_nach_mandates_org_id ON public.rbl_nach_mandates(org_id);
CREATE INDEX idx_rbl_nach_mandates_loan_id ON public.rbl_nach_mandates(loan_application_id);
CREATE INDEX idx_rbl_nach_mandates_umrn ON public.rbl_nach_mandates(umrn);

-- Trigger for updated_at
CREATE TRIGGER update_rbl_bank_config_updated_at
  BEFORE UPDATE ON public.rbl_bank_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rbl_payment_transactions_updated_at
  BEFORE UPDATE ON public.rbl_payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rbl_nach_mandates_updated_at
  BEFORE UPDATE ON public.rbl_nach_mandates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();