-- Drop the unnecessary loan_assignable_users table
DROP TABLE IF EXISTS public.loan_assignable_users;

-- Update the get_next_assignee function to use user_roles with sales_agent role
CREATE OR REPLACE FUNCTION public.get_next_assignee(p_org_id UUID)
RETURNS UUID AS $$
DECLARE
  v_last_user_id UUID;
  v_last_created_at TIMESTAMPTZ;
  v_next_user_id UUID;
BEGIN
  -- Get last assigned user from config
  SELECT last_assigned_user_id INTO v_last_user_id
  FROM loan_assignment_config
  WHERE org_id = p_org_id;

  -- Get the created_at of last assigned user from user_roles
  IF v_last_user_id IS NOT NULL THEN
    SELECT created_at INTO v_last_created_at
    FROM user_roles
    WHERE user_id = v_last_user_id 
      AND org_id = p_org_id 
      AND role = 'sales_agent' 
      AND is_active = true;
  END IF;

  -- Get next sales agent after the last one (ordered by created_at)
  SELECT user_id INTO v_next_user_id
  FROM user_roles
  WHERE org_id = p_org_id 
    AND role = 'sales_agent' 
    AND is_active = true
    AND (v_last_created_at IS NULL OR created_at > v_last_created_at)
  ORDER BY created_at
  LIMIT 1;

  -- Wrap around to first sales agent if no next found
  IF v_next_user_id IS NULL THEN
    SELECT user_id INTO v_next_user_id
    FROM user_roles
    WHERE org_id = p_org_id 
      AND role = 'sales_agent' 
      AND is_active = true
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- Update config with new assignment
  IF v_next_user_id IS NOT NULL THEN
    INSERT INTO loan_assignment_config (org_id, last_assigned_user_id, last_assigned_at)
    VALUES (p_org_id, v_next_user_id, now())
    ON CONFLICT (org_id) DO UPDATE SET
      last_assigned_user_id = v_next_user_id,
      last_assigned_at = now(),
      updated_at = now();
  END IF;

  RETURN v_next_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;