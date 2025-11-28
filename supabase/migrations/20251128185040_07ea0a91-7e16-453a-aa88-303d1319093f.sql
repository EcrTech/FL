-- Fix RLS infinite recursion by using security definer functions

-- Step 1: Drop problematic policies that cause circular dependencies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view org roles" ON public.user_roles;

-- Step 2: Recreate profiles policy using has_role() security definer function
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Step 3: Recreate user_roles policy using get_user_org_id() security definer function
CREATE POLICY "Users can view org roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  org_id = public.get_user_org_id(auth.uid())
);

-- Step 4: Add admin management policy for user_roles using has_role()
CREATE POLICY "Admins can manage roles in org"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  AND org_id = public.get_user_org_id(auth.uid())
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  AND org_id = public.get_user_org_id(auth.uid())
);