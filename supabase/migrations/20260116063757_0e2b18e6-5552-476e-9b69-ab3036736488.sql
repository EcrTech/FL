-- Add bank account fields to loan_applicants table
ALTER TABLE public.loan_applicants
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_branch TEXT,
ADD COLUMN IF NOT EXISTS bank_account_holder_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_type TEXT DEFAULT 'savings',
ADD COLUMN IF NOT EXISTS bank_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bank_verified_at TIMESTAMPTZ;

-- Create table for additional referrals
CREATE TABLE IF NOT EXISTS public.loan_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES public.loan_applicants(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referral_type TEXT NOT NULL CHECK (referral_type IN ('professional', 'personal', 'family', 'other')),
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  address TEXT,
  relationship TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policy for loan_referrals using user_roles table
CREATE POLICY "Users can manage referrals for their org applications"
ON public.loan_referrals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.org_id = loan_referrals.org_id
    AND ur.user_id = auth.uid()
    AND ur.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.org_id = loan_referrals.org_id
    AND ur.user_id = auth.uid()
    AND ur.is_active = true
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_loan_referrals_application_id ON public.loan_referrals(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_loan_referrals_applicant_id ON public.loan_referrals(applicant_id);

-- Trigger for updated_at
CREATE TRIGGER update_loan_referrals_updated_at
BEFORE UPDATE ON public.loan_referrals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();