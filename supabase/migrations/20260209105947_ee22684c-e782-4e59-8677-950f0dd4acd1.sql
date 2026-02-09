
-- Step 1: Create get_visible_user_ids() function
CREATE OR REPLACE FUNCTION public.get_visible_user_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _role text;
  _designation_id uuid;
  _subordinate_ids uuid[];
  _visible_user_ids uuid[];
BEGIN
  -- Get the user's org, role, and designation
  SELECT p.org_id, p.role, p.designation_id
  INTO _org_id, _role, _designation_id
  FROM profiles p
  WHERE p.id = _user_id;

  -- Admins/super_admins see everything: return NULL as signal
  IF _role IN ('admin', 'super_admin') THEN
    RETURN NULL;
  END IF;

  -- Get subordinate designation IDs using existing get_subordinates()
  SELECT ARRAY(
    SELECT id FROM get_subordinates(_designation_id)
  ) INTO _subordinate_ids;

  -- Add own designation
  _subordinate_ids := array_append(_subordinate_ids, _designation_id);

  -- Get all user IDs in the same org whose designation is in the list
  SELECT ARRAY(
    SELECT p.id FROM profiles p
    WHERE p.org_id = _org_id
      AND p.designation_id = ANY(_subordinate_ids)
  ) INTO _visible_user_ids;

  RETURN _visible_user_ids;
END;
$$;

-- Step 2: Replace SELECT policy on contacts
DROP POLICY IF EXISTS "Users can view contacts in their org" ON public.contacts;

CREATE POLICY "Users can view contacts in their org"
ON public.contacts
FOR SELECT
USING (
  org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  AND (
    -- Admins see all
    get_visible_user_ids(auth.uid()) IS NULL
    -- Unassigned contacts visible to all
    OR assigned_to IS NULL
    -- Assigned to self or subordinate
    OR assigned_to = ANY(get_visible_user_ids(auth.uid()))
  )
);

-- Step 3: Replace SELECT policy on loan_applications
DROP POLICY IF EXISTS "Users can view loan applications in their org" ON public.loan_applications;

CREATE POLICY "Users can view loan applications in their org"
ON public.loan_applications
FOR SELECT
USING (
  org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  AND (
    get_visible_user_ids(auth.uid()) IS NULL
    OR assigned_to IS NULL
    OR assigned_to = ANY(get_visible_user_ids(auth.uid()))
  )
);
