-- Add parent_application_id for repeat loan tracking
ALTER TABLE public.loan_applications 
ADD COLUMN parent_application_id UUID REFERENCES public.loan_applications(id);

-- Add index for efficient lookup
CREATE INDEX idx_loan_applications_parent ON public.loan_applications(parent_application_id) WHERE parent_application_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.loan_applications.parent_application_id IS 'References the original disbursed application for repeat loans';