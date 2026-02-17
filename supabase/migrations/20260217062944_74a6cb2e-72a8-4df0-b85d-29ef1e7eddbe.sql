
-- Fix loan_applications: unassigned leads visible only to admin/super_admin
DROP POLICY IF EXISTS "Users can view loan applications in their org" ON public.loan_applications;

CREATE POLICY "Users can view loan applications in their org"
ON public.loan_applications FOR SELECT
TO public
USING (
  org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  AND (
    -- Admin/super_admin see everything
    get_visible_user_ids(auth.uid()) IS NULL
    -- Non-admins see only leads assigned to them or their reportees
    OR (assigned_to IS NOT NULL AND assigned_to = ANY(get_visible_user_ids(auth.uid())))
    -- Admins can also see unassigned
    OR (assigned_to IS NULL AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['admin'::app_role, 'super_admin'::app_role])
    ))
  )
);

-- Fix contacts: same logic for unassigned contacts
DROP POLICY IF EXISTS "Users can view contacts in their org" ON public.contacts;

CREATE POLICY "Users can view contacts in their org"
ON public.contacts FOR SELECT
TO public
USING (
  org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  AND (
    get_visible_user_ids(auth.uid()) IS NULL
    OR (assigned_to IS NOT NULL AND assigned_to = ANY(get_visible_user_ids(auth.uid())))
    OR (assigned_to IS NULL AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['admin'::app_role, 'super_admin'::app_role])
    ))
  )
);

-- Also fix the hierarchy-based contacts policy which has the same issue
DROP POLICY IF EXISTS "Users can view contacts in their org based on hierarchy" ON public.contacts;

CREATE POLICY "Users can view contacts in their org based on hierarchy"
ON public.contacts FOR SELECT
TO public
USING (
  (assigned_to = ANY(get_visible_user_ids(auth.uid())))
  OR (
    assigned_to IS NULL AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['admin'::app_role, 'super_admin'::app_role])
    )
  )
);
