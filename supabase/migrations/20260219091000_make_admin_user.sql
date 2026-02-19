-- Make a@in-sync.co.in an admin for the platform org
-- First check if user exists, then upsert their role

DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid := 'a31a6056-72c8-458a-9bd8-1c43e8360095';
BEGIN
  -- Find the user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'a@in-sync.co.in';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User a@in-sync.co.in not found. They need to sign up first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found user: %', v_user_id;

  -- Ensure they have a profile - insert if missing, update if exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    INSERT INTO public.profiles (id, org_id, email, first_name, is_active, onboarding_completed)
    VALUES (v_user_id, v_org_id, 'a@in-sync.co.in', 'Admin', true, false);
    RAISE NOTICE 'Created profile for user';
  ELSE
    UPDATE public.profiles
    SET org_id = v_org_id
    WHERE id = v_user_id AND (org_id IS NULL OR org_id != v_org_id);
    RAISE NOTICE 'Updated profile org_id';
  END IF;

  -- Upsert admin role: update existing role or insert new one
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND org_id = v_org_id
  ) THEN
    UPDATE public.user_roles
    SET role = 'admin', is_active = true
    WHERE user_id = v_user_id AND org_id = v_org_id;
    RAISE NOTICE 'Updated existing role to admin';
  ELSE
    INSERT INTO public.user_roles (user_id, org_id, role, is_active)
    VALUES (v_user_id, v_org_id, 'admin', true);
    RAISE NOTICE 'Inserted new admin role';
  END IF;
END $$;
