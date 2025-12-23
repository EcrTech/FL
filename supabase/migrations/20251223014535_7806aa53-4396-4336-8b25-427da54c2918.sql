-- Add proof_of_disbursement column to loan_disbursements table
ALTER TABLE public.loan_disbursements
ADD COLUMN IF NOT EXISTS proof_document_path text,
ADD COLUMN IF NOT EXISTS proof_uploaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS proof_uploaded_by uuid REFERENCES auth.users(id);

-- Add org_id column if not exists for RLS
ALTER TABLE public.loan_disbursements
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- Update org_id from loan_applications for existing records
UPDATE public.loan_disbursements ld
SET org_id = la.org_id
FROM public.loan_applications la
WHERE ld.loan_application_id = la.id
AND ld.org_id IS NULL;