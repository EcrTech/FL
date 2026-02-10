
CREATE OR REPLACE FUNCTION public.check_admin_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF NEW.role IN ('admin', 'super_admin') THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.user_roles
    WHERE org_id = NEW.org_id 
      AND role IN ('admin', 'super_admin')
      AND (TG_OP = 'INSERT' OR id != NEW.id);
    
    IF admin_count >= 10 THEN
      RAISE EXCEPTION 'Maximum number of admins (10) reached for this organization';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
