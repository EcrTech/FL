-- Allow anonymous users to view basic profile info for active referrers
CREATE POLICY "Anonymous can view referrer profiles" 
ON public.profiles 
FOR SELECT 
TO anon 
USING (
  id IN (
    SELECT user_id FROM user_referral_codes WHERE is_active = true
  )
);