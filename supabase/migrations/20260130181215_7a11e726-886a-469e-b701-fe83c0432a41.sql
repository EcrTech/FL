-- Add loan_application_id column to call_logs table
ALTER TABLE public.call_logs
ADD COLUMN loan_application_id UUID REFERENCES public.loan_applications(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_call_logs_loan_application_id ON public.call_logs(loan_application_id);

-- Add applicant_id column for direct applicant reference
ALTER TABLE public.call_logs
ADD COLUMN applicant_id UUID REFERENCES public.loan_applicants(id) ON DELETE SET NULL;

-- Create index for applicant lookups
CREATE INDEX idx_call_logs_applicant_id ON public.call_logs(applicant_id);