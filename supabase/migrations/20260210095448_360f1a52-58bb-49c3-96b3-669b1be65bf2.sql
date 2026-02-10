
-- Drop the existing SELECT policy on contacts and replace with admin-gated unassigned leads
DROP POLICY IF EXISTS "Users can view contacts in their org based on hierarchy" ON public.contacts;

CREATE POLICY "Users can view contacts in their org based on hierarchy"
ON public.contacts
FOR SELECT
USING (
  (assigned_to = ANY(get_visible_user_ids(auth.uid())))
  OR
  (assigned_to IS NULL AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  ))
);
