-- Debug: list all whatsapp templates and their details
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT template_name, template_id, status, category, language,
           submission_status, content, header_type, header_content,
           buttons, footer_text
    FROM public.communication_templates
    WHERE org_id = 'a31a6056-72c8-458a-9bd8-1c43e8360095'
      AND template_type = 'whatsapp'
    ORDER BY template_name
  LOOP
    RAISE NOTICE 'Template: %, ID: %, Status: %, Category: %, Language: %, Content: %',
      r.template_name, r.template_id, r.status, r.category, r.language, LEFT(r.content, 100);
  END LOOP;
END $$;
