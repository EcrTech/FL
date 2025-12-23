-- Drop the existing check constraint and add a new one with daily_schedule
ALTER TABLE public.loan_generated_documents 
DROP CONSTRAINT IF EXISTS loan_generated_documents_document_type_check;

ALTER TABLE public.loan_generated_documents 
ADD CONSTRAINT loan_generated_documents_document_type_check 
CHECK (document_type IN ('sanction_letter', 'loan_agreement', 'daily_schedule', 'kfs', 'dpn'));