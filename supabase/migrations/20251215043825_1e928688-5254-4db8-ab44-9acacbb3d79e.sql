-- Add tenure columns to loan_applications table
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS tenure_months INTEGER,
ADD COLUMN IF NOT EXISTS tenure_days INTEGER;