
-- Trigger function: sync assigned_to from loan_applications to contacts
CREATE OR REPLACE FUNCTION public.sync_contact_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND
     (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    UPDATE contacts
    SET assigned_to = NEW.assigned_to
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on loan_applications
CREATE TRIGGER sync_contact_assignment_on_update
AFTER UPDATE OF assigned_to ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_contact_assignment();

-- Also sync on INSERT (for bulk uploads with pre-set assignment)
CREATE TRIGGER sync_contact_assignment_on_insert
AFTER INSERT ON public.loan_applications
FOR EACH ROW
WHEN (NEW.assigned_to IS NOT NULL AND NEW.contact_id IS NOT NULL)
EXECUTE FUNCTION public.sync_contact_assignment();

-- Backfill existing records
UPDATE contacts c
SET assigned_to = la.assigned_to
FROM loan_applications la
WHERE la.contact_id = c.id
  AND la.assigned_to IS NOT NULL
  AND c.assigned_to IS NULL;
