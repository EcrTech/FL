-- Fix existing applications with empty application_number
UPDATE loan_applications 
SET application_number = 'PL-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD(id::text, 4, '0')
WHERE application_number = '' OR application_number IS NULL;

-- Update trigger function to handle both NULL and empty strings
CREATE OR REPLACE FUNCTION set_loan_application_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for NULL OR empty string
  IF NEW.application_number IS NULL OR NEW.application_number = '' THEN
    NEW.application_number := generate_loan_application_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';