
-- Create a simple RPC function to get next sequence value as text
CREATE OR REPLACE FUNCTION public.nextval_text(seq_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN nextval(seq_name)::TEXT;
END;
$$;
