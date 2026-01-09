-- Customer ID sequence and trigger
CREATE SEQUENCE IF NOT EXISTS customer_id_seq START 1;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_id TEXT UNIQUE;

CREATE OR REPLACE FUNCTION generate_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := 'CUST-' || to_char(NOW(), 'YYYYMM') || '-' || 
                       LPAD(nextval('customer_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_customer_id ON contacts;
CREATE TRIGGER set_customer_id
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION generate_customer_id();

-- Loan ID sequence and trigger
CREATE SEQUENCE IF NOT EXISTS loan_id_seq START 1;

ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS loan_id TEXT UNIQUE;

CREATE OR REPLACE FUNCTION generate_loan_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.loan_id IS NULL THEN
    NEW.loan_id := 'LOAN-' || to_char(NOW(), 'YYYYMM') || '-' || 
                   LPAD(nextval('loan_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_loan_id ON loan_applications;
CREATE TRIGGER set_loan_id
  BEFORE INSERT ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION generate_loan_id();

-- Backfill existing contacts without customer_id
UPDATE contacts 
SET customer_id = 'CUST-' || to_char(created_at, 'YYYYMM') || '-' || 
                  LPAD(nextval('customer_id_seq')::TEXT, 5, '0')
WHERE customer_id IS NULL;

-- Backfill existing loan applications without loan_id
UPDATE loan_applications 
SET loan_id = 'LOAN-' || to_char(created_at, 'YYYYMM') || '-' || 
              LPAD(nextval('loan_id_seq')::TEXT, 5, '0')
WHERE loan_id IS NULL;