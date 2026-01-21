-- ==========================================================
-- NUPAY EMANDATE 2.1 INTEGRATION
-- Drop RBL tables and create Nupay schema
-- ==========================================================

-- Drop existing RBL tables (no production data)
DROP TABLE IF EXISTS public.rbl_payment_transactions CASCADE;
DROP TABLE IF EXISTS public.rbl_nach_mandates CASCADE;
DROP TABLE IF EXISTS public.rbl_bank_config CASCADE;

-- ==========================================================
-- CREATE NUPAY TABLES
-- ==========================================================

-- 1. Nupay Configuration (Organization API settings)
CREATE TABLE public.nupay_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('uat', 'production')),
  api_key TEXT NOT NULL,
  api_endpoint TEXT NOT NULL DEFAULT 'https://nachuat.nupaybiz.com',
  webhook_url TEXT,
  redirect_url TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, environment)
);

-- 2. Nupay Auth Tokens (JWT Token Cache)
CREATE TABLE public.nupay_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('uat', 'production')),
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, environment)
);

-- 3. Nupay Banks (Cached Bank List)
CREATE TABLE public.nupay_banks (
  id SERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  mode TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, bank_id, mode)
);

-- 4. Nupay Mandates (eMandate Records)
CREATE TABLE public.nupay_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  -- Nupay identifiers
  nupay_id TEXT,
  nupay_ref_no TEXT,
  umrn TEXT,
  npci_ref TEXT,
  
  -- Mandate details
  loan_no TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'expired', 'cancelled')),
  seq_type TEXT NOT NULL CHECK (seq_type IN ('RCUR', 'OOFF')),
  frequency TEXT NOT NULL CHECK (frequency IN ('ADHO', 'INDA', 'DAIL', 'WEEK', 'MNTH', 'QURT', 'MIAN', 'YEAR', 'BIMN')),
  category_id INTEGER NOT NULL DEFAULT 7,
  
  -- Amount
  collection_amount NUMERIC(15, 2) NOT NULL,
  debit_type BOOLEAN DEFAULT false,
  
  -- Dates
  first_collection_date DATE NOT NULL,
  final_collection_date DATE,
  collection_until_cancel BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  
  -- Bank account details
  account_holder_name TEXT NOT NULL,
  bank_account_no TEXT NOT NULL,
  ifsc_code TEXT,
  bank_id INTEGER NOT NULL,
  bank_name TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN ('Savings', 'Current', 'OTHER')),
  auth_type TEXT CHECK (auth_type IN ('NetBanking', 'DebitCard', 'Aadhaar', 'Other', '')),
  
  -- Contact info
  mobile_no TEXT NOT NULL,
  email TEXT,
  
  -- Additional data
  additional_data JSONB DEFAULT '{}',
  
  -- Response tracking
  registration_url TEXT,
  rejection_reason_code TEXT,
  rejection_reason_desc TEXT,
  rejected_by TEXT,
  
  -- Payloads for debugging
  request_payload JSONB,
  response_payload JSONB,
  webhook_payload JSONB,
  
  -- Audit
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- ENABLE ROW LEVEL SECURITY
-- ==========================================================

ALTER TABLE public.nupay_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nupay_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nupay_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nupay_mandates ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- RLS POLICIES: nupay_config
-- ==========================================================

CREATE POLICY "Users can view their org nupay config"
ON public.nupay_config FOR SELECT
USING (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

CREATE POLICY "Admins can insert nupay config"
ON public.nupay_config FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin') AND ur.is_active = true
  )
);

CREATE POLICY "Admins can update nupay config"
ON public.nupay_config FOR UPDATE
USING (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin') AND ur.is_active = true
  )
);

CREATE POLICY "Admins can delete nupay config"
ON public.nupay_config FOR DELETE
USING (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin') AND ur.is_active = true
  )
);

-- ==========================================================
-- RLS POLICIES: nupay_auth_tokens (Service role only)
-- ==========================================================

CREATE POLICY "Service role can manage auth tokens"
ON public.nupay_auth_tokens FOR ALL
USING (true)
WITH CHECK (true);

-- ==========================================================
-- RLS POLICIES: nupay_banks
-- ==========================================================

CREATE POLICY "Users can view their org banks"
ON public.nupay_banks FOR SELECT
USING (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

CREATE POLICY "Users can insert banks for their org"
ON public.nupay_banks FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

CREATE POLICY "Users can update their org banks"
ON public.nupay_banks FOR UPDATE
USING (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

CREATE POLICY "Users can delete their org banks"
ON public.nupay_banks FOR DELETE
USING (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

-- ==========================================================
-- RLS POLICIES: nupay_mandates
-- ==========================================================

CREATE POLICY "Users can view their org mandates"
ON public.nupay_mandates FOR SELECT
USING (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

CREATE POLICY "Users can create mandates for their org"
ON public.nupay_mandates FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

CREATE POLICY "Users can update their org mandates"
ON public.nupay_mandates FOR UPDATE
USING (
  org_id IN (
    SELECT ur.org_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

-- ==========================================================
-- INDEXES
-- ==========================================================

CREATE INDEX idx_nupay_config_org_env ON public.nupay_config(org_id, environment);
CREATE INDEX idx_nupay_auth_tokens_org_env ON public.nupay_auth_tokens(org_id, environment);
CREATE INDEX idx_nupay_banks_org ON public.nupay_banks(org_id);
CREATE INDEX idx_nupay_mandates_org ON public.nupay_mandates(org_id);
CREATE INDEX idx_nupay_mandates_loan_app ON public.nupay_mandates(loan_application_id);
CREATE INDEX idx_nupay_mandates_status ON public.nupay_mandates(status);
CREATE INDEX idx_nupay_mandates_nupay_id ON public.nupay_mandates(nupay_id);
CREATE INDEX idx_nupay_mandates_umrn ON public.nupay_mandates(umrn);

-- ==========================================================
-- TRIGGER FOR updated_at
-- ==========================================================

CREATE TRIGGER update_nupay_config_updated_at
  BEFORE UPDATE ON public.nupay_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nupay_mandates_updated_at
  BEFORE UPDATE ON public.nupay_mandates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();