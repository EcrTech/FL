
-- Update trigger function to use 6-digit padding
CREATE OR REPLACE FUNCTION public.set_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := 'CUST-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('customer_id_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Backfill existing records: extract numeric suffix and re-pad to 6 digits
UPDATE public.contacts
SET customer_id = regexp_replace(customer_id, '-(\d+)$', '-' || lpad(substring(customer_id from '-(\d+)$'), 6, '0'))
WHERE customer_id IS NOT NULL;
