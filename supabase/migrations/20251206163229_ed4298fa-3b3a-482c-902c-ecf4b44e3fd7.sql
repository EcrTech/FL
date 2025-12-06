-- Add RLS policy to allow public/anonymous users to view active referral codes
-- This is needed for the referral link page which is accessed by non-authenticated users
CREATE POLICY "Anyone can view active referral codes for validation" 
ON public.user_referral_codes 
FOR SELECT 
USING (is_active = true);