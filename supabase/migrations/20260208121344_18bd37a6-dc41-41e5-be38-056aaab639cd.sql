ALTER TABLE public.organization_loan_settings
  ADD COLUMN IF NOT EXISTS bounce_charges integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS penal_interest_rate numeric NOT NULL DEFAULT 24;