-- Drop existing constraint
ALTER TABLE loan_generated_documents 
DROP CONSTRAINT loan_generated_documents_document_type_check;

-- Add new constraint with combined_loan_pack
ALTER TABLE loan_generated_documents 
ADD CONSTRAINT loan_generated_documents_document_type_check 
CHECK (document_type = ANY (ARRAY[
  'sanction_letter'::text, 
  'loan_agreement'::text, 
  'daily_schedule'::text, 
  'kfs'::text, 
  'dpn'::text,
  'combined_loan_pack'::text
]));