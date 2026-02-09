
DO $$
DECLARE
  target_ids uuid[];
  target_applicant_ids uuid[];
BEGIN
  SELECT array_agg(la.id) INTO target_ids
  FROM loan_applications la
  LEFT JOIN loan_applicants ap ON ap.loan_application_id = la.id AND ap.applicant_type = 'primary'
  WHERE la.status = 'draft'
     OR LOWER(ap.first_name) IN ('saman', 'sonu', 'abhishek');

  IF target_ids IS NULL OR array_length(target_ids, 1) IS NULL THEN
    RAISE NOTICE 'No matching applications found';
    RETURN;
  END IF;

  SELECT array_agg(id) INTO target_applicant_ids
  FROM loan_applicants WHERE loan_application_id = ANY(target_ids);

  -- All child tables referencing loan_applications
  DELETE FROM loan_repayment_schedule WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_payments WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_disbursements WHERE loan_application_id = ANY(target_ids);
  DELETE FROM document_esign_requests WHERE application_id = ANY(target_ids);
  DELETE FROM loan_generated_documents WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_sanctions WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_approvals WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_deviations WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_eligibility WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_income_summaries WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_documents WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_verifications WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_referrals WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_stage_history WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_audit_log WHERE loan_application_id = ANY(target_ids);
  DELETE FROM call_logs WHERE loan_application_id = ANY(target_ids);
  DELETE FROM videokyc_recordings WHERE application_id = ANY(target_ids);
  DELETE FROM nupay_mandates WHERE loan_application_id = ANY(target_ids);
  DELETE FROM nupay_upi_transactions WHERE loan_application_id = ANY(target_ids);
  DELETE FROM sms_automation_executions WHERE loan_application_id = ANY(target_ids);
  DELETE FROM sms_messages WHERE loan_application_id = ANY(target_ids);

  -- Tables keyed by applicant_id
  IF target_applicant_ids IS NOT NULL THEN
    DELETE FROM loan_credit_bureau_reports WHERE applicant_id = ANY(target_applicant_ids);
    DELETE FROM loan_bank_analysis WHERE applicant_id = ANY(target_applicant_ids);
    DELETE FROM loan_employment_details WHERE applicant_id = ANY(target_applicant_ids);
  END IF;

  -- Parent tables
  DELETE FROM loan_applicants WHERE loan_application_id = ANY(target_ids);
  DELETE FROM loan_applications WHERE id = ANY(target_ids);
END $$;
