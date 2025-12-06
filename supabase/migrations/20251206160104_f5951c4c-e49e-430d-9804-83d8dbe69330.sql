-- Fix function search path for generate_referral_code
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_name TEXT;
  v_prefix TEXT;
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Get user's first name
  SELECT UPPER(SUBSTRING(full_name FROM 1 FOR 3))
  INTO v_prefix
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Default prefix if name not found
  IF v_prefix IS NULL OR LENGTH(v_prefix) < 3 THEN
    v_prefix := 'REF';
  END IF;
  
  -- Generate unique code
  LOOP
    v_code := v_prefix || '-' || UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.user_referral_codes WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;