-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can manage WhatsApp settings" ON whatsapp_settings;

-- Create new policy with proper WITH CHECK clause for INSERT operations
CREATE POLICY "Admins can manage WhatsApp settings" 
ON whatsapp_settings
FOR ALL 
TO public
USING (
  (org_id = get_user_org_id(auth.uid())) 
  AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  (org_id = get_user_org_id(auth.uid())) 
  AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);