
-- Function: auto-assign leads to their creator (for non-admin users)
CREATE OR REPLACE FUNCTION public.auto_assign_to_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL AND NEW.created_by IS NOT NULL THEN
    -- Only auto-assign if creator is NOT an admin or super_admin
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.created_by
        AND role IN ('admin', 'super_admin')
    ) THEN
      NEW.assigned_to := NEW.created_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on contacts
CREATE TRIGGER auto_assign_contact_to_creator
  BEFORE INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_to_creator();

-- Trigger on loan_applications
CREATE TRIGGER auto_assign_loan_app_to_creator
  BEFORE INSERT ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_to_creator();
