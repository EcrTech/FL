-- Fix search_path for update_emi_updated_at function
CREATE OR REPLACE FUNCTION public.update_emi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path = public;