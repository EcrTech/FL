-- Create function to auto-assign Lead stage for new contacts
CREATE OR REPLACE FUNCTION public.auto_assign_lead_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if pipeline_stage_id is null
  IF NEW.pipeline_stage_id IS NULL THEN
    SELECT id INTO NEW.pipeline_stage_id
    FROM public.pipeline_stages
    WHERE org_id = NEW.org_id 
      AND name = 'Lead'
      AND is_active = true
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on contacts table
DROP TRIGGER IF EXISTS auto_assign_lead_stage_trigger ON public.contacts;
CREATE TRIGGER auto_assign_lead_stage_trigger
  BEFORE INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_lead_stage();