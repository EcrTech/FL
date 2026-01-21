-- Table to track round-robin state per organization
CREATE TABLE public.loan_assignment_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_assigned_at TIMESTAMPTZ DEFAULT now(),
  is_round_robin_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id)
);

-- Table for users who can be assigned applications
CREATE TABLE public.loan_assignable_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  priority_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Enable RLS
ALTER TABLE public.loan_assignment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_assignable_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for assignment config
CREATE POLICY "Users can view their org assignment config"
  ON public.loan_assignment_config FOR SELECT
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their org assignment config"
  ON public.loan_assignment_config FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their org assignment config"
  ON public.loan_assignment_config FOR UPDATE
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- RLS policies for assignable users
CREATE POLICY "Users can view assignable users in their org"
  ON public.loan_assignable_users FOR SELECT
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert assignable users in their org"
  ON public.loan_assignable_users FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update assignable users in their org"
  ON public.loan_assignable_users FOR UPDATE
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete assignable users in their org"
  ON public.loan_assignable_users FOR DELETE
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Function to get next assignee in round-robin order
CREATE OR REPLACE FUNCTION public.get_next_assignee(p_org_id UUID)
RETURNS UUID AS $$
DECLARE
  v_last_user_id UUID;
  v_last_priority INT;
  v_next_user_id UUID;
  v_is_enabled BOOLEAN;
BEGIN
  -- Check if round-robin is enabled and get last assigned user
  SELECT last_assigned_user_id, is_round_robin_enabled INTO v_last_user_id, v_is_enabled
  FROM loan_assignment_config
  WHERE org_id = p_org_id;

  -- If not enabled, return null
  IF v_is_enabled = false THEN
    RETURN NULL;
  END IF;

  -- Get the priority of last assigned user
  IF v_last_user_id IS NOT NULL THEN
    SELECT priority_order INTO v_last_priority
    FROM loan_assignable_users
    WHERE user_id = v_last_user_id AND org_id = p_org_id AND is_active = true;
  END IF;

  -- Get the next user in round-robin order
  SELECT user_id INTO v_next_user_id
  FROM loan_assignable_users
  WHERE org_id = p_org_id AND is_active = true
    AND (v_last_priority IS NULL OR priority_order > v_last_priority)
  ORDER BY priority_order
  LIMIT 1;

  -- If no next user found, wrap around to the first
  IF v_next_user_id IS NULL THEN
    SELECT user_id INTO v_next_user_id
    FROM loan_assignable_users
    WHERE org_id = p_org_id AND is_active = true
    ORDER BY priority_order
    LIMIT 1;
  END IF;

  -- Update the config with the new assignment
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;