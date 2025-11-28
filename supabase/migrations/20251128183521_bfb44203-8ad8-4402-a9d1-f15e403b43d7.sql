
-- Fix infinite recursion in RLS policies by simplifying user_roles policies

-- Drop existing problematic policies on user_roles
DROP POLICY IF EXISTS "Users can view roles in their org" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;

-- Create simpler policies that don't cause circular dependencies
-- Allow users to view their own roles without complex checks
CREATE POLICY "Users can view own roles"
ON user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow admins to manage roles by checking the user_roles table directly
-- This avoids the circular dependency with profiles
CREATE POLICY "Admins can manage all roles"
ON user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles admin_check
    WHERE admin_check.user_id = auth.uid()
    AND admin_check.role IN ('admin', 'super_admin')
  )
);

-- Allow users to view roles in their org (simplified without get_user_org_id)
CREATE POLICY "Users can view org roles"
ON user_roles
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE id = auth.uid()
  )
);
