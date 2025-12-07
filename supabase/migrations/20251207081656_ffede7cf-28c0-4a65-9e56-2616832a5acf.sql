-- Drop the existing policy that doesn't work for anonymous users
DROP POLICY IF EXISTS "Anyone can view active referral codes for validation" ON user_referral_codes;

-- Create a policy that explicitly allows anonymous users to read active referral codes
CREATE POLICY "Anonymous users can view active referral codes" 
ON user_referral_codes 
FOR SELECT 
TO anon
USING (is_active = true);