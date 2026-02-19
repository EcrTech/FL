-- ============================================================
-- STAGING DATABASE RESET SCRIPT
-- Clears all transactional data, keeps org/user/config tables
-- ============================================================
-- WARNING: This will permanently delete all transactional data!
-- Only run this on STAGING environments, never production.
-- ============================================================

BEGIN;

-- Disable triggers temporarily for faster truncation
SET session_replication_role = 'replica';

-- ============================================================
-- 1. LOAN CHILD TABLES (deepest dependencies first)
-- ============================================================
TRUNCATE TABLE IF EXISTS
  loan_audit_log,
  loan_stage_history,
  loan_repayment_schedule,
  loan_disbursements,
  loan_generated_documents,
  loan_sanctions,
  loan_deviations,
  loan_approvals,
  loan_eligibility,
  loan_bank_analysis,
  loan_credit_bureau_reports,
  loan_negative_areas,
  loan_verifications,
  loan_documents,
  loan_employment_details,
  loan_referrals,
  loan_payments
CASCADE;

-- Loan income summaries (may be named differently)
TRUNCATE TABLE IF EXISTS loan_income_summaries CASCADE;
TRUNCATE TABLE IF EXISTS loan_bank_income_summaries CASCADE;

-- ============================================================
-- 2. LOAN APPLICANTS & APPLICATIONS
-- ============================================================
TRUNCATE TABLE IF EXISTS loan_applicants CASCADE;
TRUNCATE TABLE IF EXISTS loan_applications CASCADE;

-- ============================================================
-- 3. CONTACTS & RELATED
-- ============================================================
TRUNCATE TABLE IF EXISTS
  contact_activities,
  contact_emails,
  contact_phones,
  contact_tags,
  contact_tag_assignments,
  contact_enrichment_runs,
  contact_enrichment_logs,
  contact_lead_scores,
  contact_custom_fields
CASCADE;

TRUNCATE TABLE IF EXISTS contacts CASCADE;

-- ============================================================
-- 4. TASKS & ACTIVITIES
-- ============================================================
TRUNCATE TABLE IF EXISTS
  tasks,
  activity_participants
CASCADE;

-- ============================================================
-- 5. COMMUNICATION & MESSAGES
-- ============================================================
TRUNCATE TABLE IF EXISTS
  sms_messages,
  whatsapp_messages,
  whatsapp_bulk_campaigns,
  whatsapp_campaign_recipients,
  email_bulk_campaigns,
  email_campaign_recipients,
  email_conversations,
  notifications
CASCADE;

-- ============================================================
-- 6. AUTOMATION EXECUTIONS & LOGS
-- ============================================================
TRUNCATE TABLE IF EXISTS
  email_automation_executions,
  email_automation_cooldowns,
  email_automation_daily_limits,
  sms_automation_executions,
  sms_automation_cooldowns,
  email_engagement_patterns,
  campaign_analytics,
  campaign_insights,
  automation_ab_tests,
  automation_approvals,
  automation_performance_daily
CASCADE;

-- ============================================================
-- 7. CALL LOGS
-- ============================================================
TRUNCATE TABLE IF EXISTS
  call_logs,
  agent_call_sessions
CASCADE;

-- ============================================================
-- 8. DOCUMENT SIGNING & OTP
-- ============================================================
TRUNCATE TABLE IF EXISTS
  document_esign_requests,
  otp_verifications,
  public_otp_verifications
CASCADE;

-- ============================================================
-- 9. PAYMENT & TRANSACTION TABLES
-- ============================================================
TRUNCATE TABLE IF EXISTS
  payment_transactions,
  wallet_transactions,
  nupay_auth_tokens,
  nupay_mandates,
  nupay_upi_auth_tokens,
  nupay_upi_transactions,
  rbl_nach_mandates,
  rbl_payment_transactions
CASCADE;

-- ============================================================
-- 10. PIPELINE HISTORY
-- ============================================================
TRUNCATE TABLE IF EXISTS
  pipeline_movement_history,
  pipeline_benchmarks
CASCADE;

-- ============================================================
-- 11. LOGS & AUDIT TRAILS
-- ============================================================
TRUNCATE TABLE IF EXISTS
  error_logs,
  connector_logs,
  api_key_usage_logs,
  rate_limit_log,
  service_usage_logs,
  outbound_webhook_logs,
  platform_admin_audit_log,
  subscription_audit_log,
  redefine_repository_audit
CASCADE;

-- ============================================================
-- 12. DATA PROCESSING & QUEUES
-- ============================================================
TRUNCATE TABLE IF EXISTS
  import_jobs,
  operation_queue,
  redefine_data_repository
CASCADE;

-- ============================================================
-- 13. MISC TRANSACTIONAL
-- ============================================================
TRUNCATE TABLE IF EXISTS
  email_suppression_list,
  email_unsubscribes,
  subscription_invoices,
  subscription_notifications,
  videokyc_recordings,
  saved_reports
CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

-- ============================================================
-- VERIFICATION: Count remaining rows in key tables
-- ============================================================
SELECT 'contacts' AS "table", count(*) FROM contacts
UNION ALL SELECT 'loan_applications', count(*) FROM loan_applications
UNION ALL SELECT 'loan_applicants', count(*) FROM loan_applicants
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'call_logs', count(*) FROM call_logs
ORDER BY "table";
