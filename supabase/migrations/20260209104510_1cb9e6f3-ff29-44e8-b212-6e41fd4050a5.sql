
-- Seed feature_permissions with all controllable features
INSERT INTO public.feature_permissions (feature_key, feature_name, category, feature_description, is_premium)
VALUES
  ('los_dashboard', 'LOS Dashboard', 'LOS', 'Loan origination system dashboard', false),
  ('pipeline_stages', 'Leads', 'Sales & Operations', 'Pipeline and lead management', false),
  ('loan_applications', 'Loan Applications', 'LOS', 'View and manage loan applications', false),
  ('approvals', 'Approvals', 'LOS', 'Approval queue management', false),
  ('sanctions', 'Sanctions', 'LOS', 'Sanction letter management', false),
  ('disbursals', 'Disbursals', 'LOS', 'Disbursal management', false),
  ('collections', 'Collections', 'LOS', 'Collection management', false),
  ('los_reports', 'Reports', 'LOS', 'LOS reports and analytics', false),
  ('tasks', 'Tasks', 'Operations', 'Task management', false),
  ('communications', 'Communications', 'Operations', 'Communication tools', false),
  ('calling', 'Upload Leads', 'Operations', 'Upload and manage calling leads', false),
  ('redefine_data_repository', 'Data Repository', 'Operations', 'Data repository management', false),
  ('inventory', 'Inventory', 'Operations', 'Inventory management', false),
  ('users', 'Users', 'Management', 'User management', false),
  ('teams', 'Teams', 'Management', 'Team management', false),
  ('designations', 'Designations', 'Management', 'Designation management', false),
  ('connectors', 'Webhooks & Connectors', 'Integration', 'Webhook connector management', false),
  ('emandate_settings', 'eMandate Settings', 'Integration', 'eMandate/NuPay settings', false),
  ('negative_pincodes', 'Negative Pin Codes', 'Integration', 'Negative pin code management', false),
  ('exotel_settings', 'Exotel Settings', 'Integration', 'Exotel telephony settings', false)
ON CONFLICT DO NOTHING;
