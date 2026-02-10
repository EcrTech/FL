
CREATE OR REPLACE FUNCTION public.get_visible_user_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _org_id uuid;
  _designation_id uuid;
  _subordinate_ids uuid[];
  _subordinate_user_ids uuid[];
  _result uuid[];
BEGIN
  -- Get user role
  SELECT role INTO _role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  -- Admins and super_admins see everything
  IF _role IN ('admin', 'super_admin') THEN
    SELECT org_id INTO _org_id FROM profiles WHERE id = _user_id;
    SELECT array_agg(id) INTO _result FROM profiles WHERE org_id = _org_id;
    RETURN _result;
  END IF;

  -- Get the user's designation
  SELECT designation_id INTO _designation_id FROM profiles WHERE id = _user_id;

  IF _designation_id IS NULL THEN
    RETURN ARRAY[_user_id];
  END IF;

  -- Get subordinate designation IDs (fixed: was incorrectly referencing 'id')
  SELECT array_agg(designation_id) INTO _subordinate_ids
  FROM get_subordinates(_designation_id);

  IF _subordinate_ids IS NULL THEN
    RETURN ARRAY[_user_id];
  END IF;

  -- Get user IDs with those designations
  SELECT array_agg(id) INTO _subordinate_user_ids
  FROM profiles
  WHERE designation_id = ANY(_subordinate_ids);

  -- Combine current user + subordinates
  _result := ARRAY[_user_id];
  IF _subordinate_user_ids IS NOT NULL THEN
    _result := _result || _subordinate_user_ids;
  END IF;

  RETURN _result;
END;
$$;
