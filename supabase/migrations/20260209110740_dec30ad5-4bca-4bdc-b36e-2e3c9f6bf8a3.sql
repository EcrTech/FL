
CREATE OR REPLACE FUNCTION public.get_visible_user_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _designation_id uuid;
  _subordinate_ids uuid[];
  _visible_ids uuid[];
BEGIN
  -- Get user's org and designation
  SELECT p.org_id, p.designation_id
  INTO _org_id, _designation_id
  FROM profiles p WHERE p.id = _user_id;

  -- Check admin status from user_roles table
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN NULL; -- NULL signals "see all"
  END IF;

  -- If no designation, user can only see their own + unassigned
  IF _designation_id IS NULL THEN
    RETURN ARRAY[_user_id];
  END IF;

  -- Get subordinate designation IDs
  SELECT array_agg(id) INTO _subordinate_ids
  FROM get_subordinates(_designation_id);

  -- Add user's own designation
  _subordinate_ids := array_append(COALESCE(_subordinate_ids, ARRAY[]::uuid[]), _designation_id);

  -- Get all user IDs with those designations in the same org
  SELECT array_agg(DISTINCT p.id) INTO _visible_ids
  FROM profiles p
  WHERE p.org_id = _org_id
    AND p.designation_id = ANY(_subordinate_ids);

  RETURN COALESCE(_visible_ids, ARRAY[_user_id]);
END;
$$;
