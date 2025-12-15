-- Add approved_by column to track who approved/rejected the application
ALTER TABLE public.loan_applications 
ADD COLUMN approved_by uuid REFERENCES public.profiles(id);

-- Add index for better query performance
CREATE INDEX idx_loan_applications_approved_by ON public.loan_applications(approved_by);