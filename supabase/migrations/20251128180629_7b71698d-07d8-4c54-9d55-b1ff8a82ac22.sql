-- Fix security warnings: Set search_path for LOS functions

-- Fix generate_loan_application_number function
DROP FUNCTION IF EXISTS generate_loan_application_number();
CREATE OR REPLACE FUNCTION generate_loan_application_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today TEXT;
  seq_num INTEGER;
  app_num TEXT;
BEGIN
  today := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(application_number FROM 14) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM loan_applications
  WHERE application_number LIKE 'PL-' || today || '-%';
  
  -- Format: PL-YYYYMMDD-XXXX
  app_num := 'PL-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  RETURN app_num;
END;
$$;

-- Fix set_loan_application_number function
DROP FUNCTION IF EXISTS set_loan_application_number() CASCADE;
CREATE OR REPLACE FUNCTION set_loan_application_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.application_number IS NULL THEN
    NEW.application_number := generate_loan_application_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_set_loan_application_number
  BEFORE INSERT ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION set_loan_application_number();

-- Fix update_updated_at_column function (may already exist, so use CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix log_loan_stage_change function
DROP FUNCTION IF EXISTS log_loan_stage_change() CASCADE;
CREATE OR REPLACE FUNCTION log_loan_stage_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
    INSERT INTO loan_stage_history (
      loan_application_id,
      from_stage,
      to_stage,
      moved_by
    ) VALUES (
      NEW.id,
      OLD.current_stage,
      NEW.current_stage,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_log_loan_stage_change
  AFTER UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION log_loan_stage_change();