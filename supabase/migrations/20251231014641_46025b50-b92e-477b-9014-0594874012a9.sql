-- Add professional reference fields
ALTER TABLE public.loan_applicants 
ADD COLUMN IF NOT EXISTS professional_ref_name TEXT,
ADD COLUMN IF NOT EXISTS professional_ref_mobile TEXT,
ADD COLUMN IF NOT EXISTS professional_ref_email TEXT,
ADD COLUMN IF NOT EXISTS professional_ref_address TEXT;

-- Add personal reference fields
ALTER TABLE public.loan_applicants 
ADD COLUMN IF NOT EXISTS personal_ref_name TEXT,
ADD COLUMN IF NOT EXISTS personal_ref_mobile TEXT,
ADD COLUMN IF NOT EXISTS personal_ref_email TEXT,
ADD COLUMN IF NOT EXISTS personal_ref_address TEXT;