-- Remove multi-tenant organization management features
-- Keep organizations table but remove org creation/invitation system

-- Drop org_invites table (used for multi-tenant invitations)
DROP TABLE IF EXISTS public.org_invites CASCADE;

-- Drop organization creation function
DROP FUNCTION IF EXISTS public.create_organization_for_user(uuid, text, text) CASCADE;

-- Drop slug generation function (no need for unique org URLs in single-tenant)
DROP FUNCTION IF EXISTS public.generate_unique_slug(text) CASCADE;