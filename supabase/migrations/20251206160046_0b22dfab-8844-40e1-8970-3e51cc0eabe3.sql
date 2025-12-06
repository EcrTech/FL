-- Create user_referral_codes table
CREATE TABLE public.user_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  applications_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- Add referred_by column to loan_applications
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id);

-- Enable RLS
ALTER TABLE public.user_referral_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_referral_codes
CREATE POLICY "Users can view their own referral codes"
ON public.user_referral_codes
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own referral codes"
ON public.user_referral_codes
FOR INSERT
WITH CHECK (user_id = auth.uid() AND org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update their own referral codes"
ON public.user_referral_codes
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Service role has full access to referral codes"
ON public.user_referral_codes
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to generate unique referral code
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster lookups
CREATE INDEX idx_referral_codes_code ON public.user_referral_codes(referral_code);
CREATE INDEX idx_loan_applications_referred_by ON public.loan_applications(referred_by);