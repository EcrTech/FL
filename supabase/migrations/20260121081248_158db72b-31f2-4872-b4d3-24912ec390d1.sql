-- Add office_email columns to loan_applicants table
ALTER TABLE public.loan_applicants 
ADD COLUMN IF NOT EXISTS office_email TEXT,
ADD COLUMN IF NOT EXISTS office_email_verified BOOLEAN DEFAULT false;