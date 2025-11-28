-- Fix RLS infinite recursion on profiles and user_roles

-- 1) Remove profiles policy that calls get_user_org_id (recursive on profiles)
DROP POLICY IF EXISTS "Users can view profiles in their org" ON public.profiles;

-- 2) Remove user_roles policy that uses has_role() (recursive on user_roles)
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- 3) (Optional safety) Recreate a non-recursive admin management policy for user_roles using Postgres roles only
-- For now we rely on the existing "Service role can manage all user roles" policy for backend operations
-- and "Users can view own roles" / "Users can view org roles" for read access.
