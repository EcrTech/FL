-- =====================================================
-- LOS (Loan Origination System) Database Schema
-- Phase 1: Foundation & Core Tables
-- =====================================================

-- =====================================================
-- CORE LOS TABLES
-- =====================================================

-- 1. loan_applications - Main application entity
CREATE TABLE public.loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  -- Application identifiers
  application_number TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL DEFAULT 'personal_loan_salaried',
  
  -- Loan details
  requested_amount NUMERIC(12,2) NOT NULL,
  approved_amount NUMERIC(12,2),
  tenure_months INTEGER NOT NULL,
  interest_rate NUMERIC(5,2),
  
  -- Stage tracking
  current_stage TEXT NOT NULL DEFAULT 'application_login',
  previous_stage TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. loan_applicants - Applicant details (multi-applicant support)
CREATE TABLE public.loan_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  
  -- Applicant type
  applicant_type TEXT NOT NULL DEFAULT 'primary',
  
  -- Personal details
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT,
  father_name TEXT,
  mother_name TEXT,
  dob DATE NOT NULL,
  age INTEGER,
  gender TEXT,
  marital_status TEXT,
  
  -- Identity
  pan_number TEXT,
  aadhaar_number TEXT,
  
  -- Contact
  mobile TEXT NOT NULL,
  alternate_mobile TEXT,
  email TEXT,
  
  -- Address
  current_address JSONB,
  permanent_address JSONB,
  residence_type TEXT,
  years_at_current_address INTEGER,
  
  -- Education
  education_qualification TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. loan_employment_details - Employment & income info
CREATE TABLE public.loan_employment_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.loan_applicants(id) ON DELETE CASCADE,
  
  -- Employment
  employment_type TEXT NOT NULL DEFAULT 'salaried',
  employer_name TEXT NOT NULL,
  employer_type TEXT,
  employer_address TEXT,
  designation TEXT,
  department TEXT,
  employee_id TEXT,
  official_email TEXT,
  
  -- Experience
  date_of_joining DATE,
  years_in_company NUMERIC(4,1),
  total_experience NUMERIC(4,1),
  
  -- Income
  gross_monthly_salary NUMERIC(12,2) NOT NULL,
  net_monthly_salary NUMERIC(12,2) NOT NULL,
  other_income NUMERIC(12,2),
  other_income_source TEXT,
  
  -- Salary details
  salary_mode TEXT,
  salary_bank_name TEXT,
  salary_account_number TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. loan_documents - Document tracking
CREATE TABLE public.loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES public.loan_applicants(id) ON DELETE CASCADE,
  
  -- Document details
  document_type TEXT NOT NULL,
  document_category TEXT NOT NULL,
  
  -- File details
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Status
  upload_status TEXT NOT NULL DEFAULT 'pending',
  verification_status TEXT DEFAULT 'pending',
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- OCR data
  ocr_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. loan_verifications - All verification results
CREATE TABLE public.loan_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES public.loan_applicants(id) ON DELETE CASCADE,
  
  -- Verification details
  verification_type TEXT NOT NULL,
  verification_source TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Request/Response
  request_data JSONB DEFAULT '{}'::jsonb,
  response_data JSONB DEFAULT '{}'::jsonb,
  
  -- Verification details
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  remarks TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. loan_credit_bureau_reports - Credit bureau data
CREATE TABLE public.loan_credit_bureau_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.loan_applicants(id) ON DELETE CASCADE,
  
  -- Bureau details
  bureau_type TEXT NOT NULL,
  credit_score INTEGER,
  score_date DATE,
  
  -- Report data
  report_data JSONB DEFAULT '{}'::jsonb,
  
  -- Summary metrics
  enquiry_count_30d INTEGER DEFAULT 0,
  enquiry_count_90d INTEGER DEFAULT 0,
  active_accounts INTEGER DEFAULT 0,
  closed_accounts INTEGER DEFAULT 0,
  total_outstanding NUMERIC(12,2) DEFAULT 0,
  total_overdue NUMERIC(12,2) DEFAULT 0,
  
  -- DPD history
  dpd_history JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. loan_bank_analysis - Bank statement analysis
CREATE TABLE public.loan_bank_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.loan_applicants(id) ON DELETE CASCADE,
  
  -- Analysis source
  analysis_source TEXT,
  statement_period_from DATE,
  statement_period_to DATE,
  
  -- Balance metrics
  average_monthly_balance NUMERIC(12,2),
  minimum_balance NUMERIC(12,2),
  
  -- Salary credits
  salary_credits JSONB DEFAULT '[]'::jsonb,
  average_salary_amount NUMERIC(12,2),
  
  -- EMI debits
  emi_debits JSONB DEFAULT '[]'::jsonb,
  
  -- Bounce analysis
  bounce_count INTEGER DEFAULT 0,
  bounce_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Cash transactions
  cash_withdrawals NUMERIC(12,2) DEFAULT 0,
  cash_deposits NUMERIC(12,2) DEFAULT 0,
  
  -- High value transactions
  high_value_transactions JSONB DEFAULT '[]'::jsonb,
  
  -- FOIR calculation
  foir_calculated NUMERIC(5,2),
  
  -- Full analysis data
  analysis_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. loan_eligibility - Eligibility calculations
CREATE TABLE public.loan_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  
  -- Calculation date
  calculation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Income details
  gross_income NUMERIC(12,2) NOT NULL,
  net_income NUMERIC(12,2) NOT NULL,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  
  -- Obligations
  existing_emi_obligations NUMERIC(12,2) DEFAULT 0,
  proposed_emi NUMERIC(12,2) NOT NULL,
  
  -- Ratios
  foir_percentage NUMERIC(5,2),
  max_allowed_foir NUMERIC(5,2) DEFAULT 50.00,
  dti_ratio NUMERIC(5,2),
  ltv_ratio NUMERIC(5,2),
  
  -- Eligibility result
  eligible_loan_amount NUMERIC(12,2),
  recommended_tenure INTEGER,
  recommended_interest_rate NUMERIC(5,2),
  
  -- Policy checks
  policy_checks JSONB DEFAULT '[]'::jsonb,
  is_eligible BOOLEAN DEFAULT false,
  deviation_required BOOLEAN DEFAULT false,
  
  -- Calculation details
  calculation_details JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. loan_approvals - Approval workflow
CREATE TABLE public.loan_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  
  -- Approval level
  approval_level TEXT NOT NULL,
  approver_role TEXT,
  approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Approval status
  approval_status TEXT NOT NULL DEFAULT 'pending',
  
  -- Approved terms
  approved_amount NUMERIC(12,2),
  approved_tenure INTEGER,
  approved_rate NUMERIC(5,2),
  
  -- Conditions & deviations
  conditions JSONB DEFAULT '[]'::jsonb,
  deviation_details JSONB DEFAULT '{}'::jsonb,
  comments TEXT,
  
  -- Timestamps
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. loan_deviations - Deviation tracking
CREATE TABLE public.loan_deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  
  -- Deviation details
  deviation_type TEXT NOT NULL,
  deviation_description TEXT NOT NULL,
  deviation_value TEXT,
  policy_value TEXT,
  justification TEXT,
  
  -- Approval
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approval_level_required TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. loan_sanctions - Sanction letters
CREATE TABLE public.loan_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  
  -- Sanction details
  sanction_number TEXT NOT NULL UNIQUE,
  sanction_date DATE NOT NULL,
  
  -- Sanctioned terms
  sanctioned_amount NUMERIC(12,2) NOT NULL,
  sanctioned_tenure INTEGER NOT NULL,
  sanctioned_rate NUMERIC(5,2) NOT NULL,
  
  -- Fees
  processing_fee NUMERIC(12,2) DEFAULT 0,
  gst_amount NUMERIC(12,2) DEFAULT 0,
  net_disbursement_amount NUMERIC(12,2) NOT NULL,
  
  -- Conditions
  conditions JSONB DEFAULT '[]'::jsonb,
  validity_date DATE,
  
  -- Document
  sanction_letter_path TEXT,
  
  -- Customer acceptance
  customer_accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'generated',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. loan_disbursements - Disbursement tracking
CREATE TABLE public.loan_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  sanction_id UUID REFERENCES public.loan_sanctions(id) ON DELETE SET NULL,
  
  -- Disbursement details
  disbursement_number TEXT NOT NULL UNIQUE,
  disbursement_amount NUMERIC(12,2) NOT NULL,
  disbursement_date DATE,
  
  -- Bank details
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  beneficiary_name TEXT NOT NULL,
  
  -- Payment details
  utr_number TEXT,
  payment_mode TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. loan_stage_history - Stage movement audit
CREATE TABLE public.loan_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  
  -- Stage movement
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  
  -- Movement details
  moved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  comments TEXT,
  
  -- Timing
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_in_stage_minutes INTEGER
);

-- 14. loan_audit_log - Complete audit trail
CREATE TABLE public.loan_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  
  -- Action details
  action_type TEXT NOT NULL,
  action_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Change tracking
  old_value JSONB DEFAULT '{}'::jsonb,
  new_value JSONB DEFAULT '{}'::jsonb,
  
  -- Request details
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- MASTER DATA TABLES
-- =====================================================

-- loan_products - Product configuration
CREATE TABLE public.loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Product details
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  
  -- Amount range
  min_amount NUMERIC(12,2) NOT NULL,
  max_amount NUMERIC(12,2) NOT NULL,
  
  -- Tenure range
  min_tenure INTEGER NOT NULL,
  max_tenure INTEGER NOT NULL,
  
  -- Interest rates
  base_interest_rate NUMERIC(5,2) NOT NULL,
  max_interest_rate NUMERIC(5,2) NOT NULL,
  
  -- Fees
  processing_fee_percentage NUMERIC(5,2) DEFAULT 0,
  
  -- Configuration
  required_documents JSONB DEFAULT '[]'::jsonb,
  eligibility_criteria JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, product_code)
);

-- loan_policy_rules - Policy engine rules
CREATE TABLE public.loan_policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.loan_products(id) ON DELETE CASCADE,
  
  -- Rule details
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  
  -- Rule logic
  rule_condition JSONB NOT NULL,
  rule_action JSONB NOT NULL,
  
  -- Priority
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- loan_document_types - Document type master
CREATE TABLE public.loan_document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Document details
  document_code TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_category TEXT NOT NULL,
  
  -- Requirements
  is_mandatory BOOLEAN DEFAULT false,
  applies_to TEXT DEFAULT 'all',
  
  -- Validation
  validation_rules JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, document_code)
);

-- loan_negative_areas - Negative location list
CREATE TABLE public.loan_negative_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Area details
  area_type TEXT NOT NULL,
  area_value TEXT NOT NULL,
  reason TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- loan_applications indexes
CREATE INDEX idx_loan_applications_org_id ON public.loan_applications(org_id);
CREATE INDEX idx_loan_applications_contact_id ON public.loan_applications(contact_id);
CREATE INDEX idx_loan_applications_status ON public.loan_applications(status);
CREATE INDEX idx_loan_applications_current_stage ON public.loan_applications(current_stage);
CREATE INDEX idx_loan_applications_assigned_to ON public.loan_applications(assigned_to);
CREATE INDEX idx_loan_applications_created_at ON public.loan_applications(created_at DESC);

-- loan_applicants indexes
CREATE INDEX idx_loan_applicants_application_id ON public.loan_applicants(loan_application_id);
CREATE INDEX idx_loan_applicants_pan ON public.loan_applicants(pan_number);
CREATE INDEX idx_loan_applicants_mobile ON public.loan_applicants(mobile);

-- loan_documents indexes
CREATE INDEX idx_loan_documents_application_id ON public.loan_documents(loan_application_id);
CREATE INDEX idx_loan_documents_applicant_id ON public.loan_documents(applicant_id);
CREATE INDEX idx_loan_documents_verification_status ON public.loan_documents(verification_status);

-- loan_verifications indexes
CREATE INDEX idx_loan_verifications_application_id ON public.loan_verifications(loan_application_id);
CREATE INDEX idx_loan_verifications_status ON public.loan_verifications(status);

-- loan_approvals indexes
CREATE INDEX idx_loan_approvals_application_id ON public.loan_approvals(loan_application_id);
CREATE INDEX idx_loan_approvals_approver_id ON public.loan_approvals(approver_id);
CREATE INDEX idx_loan_approvals_status ON public.loan_approvals(approval_status);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_employment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_credit_bureau_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_bank_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_negative_areas ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to loan_applications"
  ON public.loan_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_applicants"
  ON public.loan_applicants FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_employment_details"
  ON public.loan_employment_details FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_documents"
  ON public.loan_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_verifications"
  ON public.loan_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_credit_bureau_reports"
  ON public.loan_credit_bureau_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_bank_analysis"
  ON public.loan_bank_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_eligibility"
  ON public.loan_eligibility FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_approvals"
  ON public.loan_approvals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_deviations"
  ON public.loan_deviations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_sanctions"
  ON public.loan_sanctions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_disbursements"
  ON public.loan_disbursements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_stage_history"
  ON public.loan_stage_history FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to loan_audit_log"
  ON public.loan_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view loan applications in their org
CREATE POLICY "Users can view loan applications in their org"
  ON public.loan_applications FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

-- Users can create loan applications in their org
CREATE POLICY "Users can create loan applications in their org"
  ON public.loan_applications FOR INSERT
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND created_by = auth.uid());

-- Users can update loan applications in their org
CREATE POLICY "Users can update loan applications in their org"
  ON public.loan_applications FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

-- Users can view applicants through applications
CREATE POLICY "Users can view loan applicants"
  ON public.loan_applicants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_applicants.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

-- Users can manage applicants
CREATE POLICY "Users can manage loan applicants"
  ON public.loan_applicants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_applicants.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

-- Similar policies for other child tables
CREATE POLICY "Users can manage employment details"
  ON public.loan_employment_details FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applicants
    JOIN public.loan_applications ON loan_applications.id = loan_applicants.loan_application_id
    WHERE loan_applicants.id = loan_employment_details.applicant_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can manage documents"
  ON public.loan_documents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_documents.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can manage verifications"
  ON public.loan_verifications FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_verifications.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view credit reports"
  ON public.loan_credit_bureau_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.loan_applicants
    JOIN public.loan_applications ON loan_applications.id = loan_applicants.loan_application_id
    WHERE loan_applicants.id = loan_credit_bureau_reports.applicant_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view bank analysis"
  ON public.loan_bank_analysis FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applicants
    JOIN public.loan_applications ON loan_applications.id = loan_applicants.loan_application_id
    WHERE loan_applicants.id = loan_bank_analysis.applicant_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view eligibility"
  ON public.loan_eligibility FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_eligibility.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view approvals"
  ON public.loan_approvals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_approvals.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view deviations"
  ON public.loan_deviations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_deviations.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view sanctions"
  ON public.loan_sanctions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_sanctions.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view disbursements"
  ON public.loan_disbursements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_disbursements.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view stage history"
  ON public.loan_stage_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_stage_history.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "Users can view audit log"
  ON public.loan_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications
    WHERE loan_applications.id = loan_audit_log.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  ));

-- Master data policies
CREATE POLICY "Users can view loan products in their org"
  ON public.loan_products FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins can manage loan products"
  ON public.loan_products FOR ALL
  USING (org_id = get_user_org_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE POLICY "Users can view policy rules in their org"
  ON public.loan_policy_rules FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins can manage policy rules"
  ON public.loan_policy_rules FOR ALL
  USING (org_id = get_user_org_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE POLICY "Users can view document types in their org"
  ON public.loan_document_types FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins can manage document types"
  ON public.loan_document_types FOR ALL
  USING (org_id = get_user_org_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE POLICY "Users can view negative areas in their org"
  ON public.loan_negative_areas FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins can manage negative areas"
  ON public.loan_negative_areas FOR ALL
  USING (org_id = get_user_org_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to generate application number
CREATE OR REPLACE FUNCTION generate_loan_application_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT;
  seq_num INTEGER;
  app_num TEXT;
BEGIN
  today := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(application_number FROM 14) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM loan_applications
  WHERE application_number LIKE 'PL-' || today || '-%';
  
  -- Format: PL-YYYYMMDD-XXXX
  app_num := 'PL-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  RETURN app_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate application number
CREATE OR REPLACE FUNCTION set_loan_application_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.application_number IS NULL THEN
    NEW.application_number := generate_loan_application_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_loan_application_number
  BEFORE INSERT ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION set_loan_application_number();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all relevant tables
CREATE TRIGGER trigger_loan_applications_updated_at
  BEFORE UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_applicants_updated_at
  BEFORE UPDATE ON loan_applicants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_employment_details_updated_at
  BEFORE UPDATE ON loan_employment_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_documents_updated_at
  BEFORE UPDATE ON loan_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_verifications_updated_at
  BEFORE UPDATE ON loan_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_bank_analysis_updated_at
  BEFORE UPDATE ON loan_bank_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_approvals_updated_at
  BEFORE UPDATE ON loan_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_deviations_updated_at
  BEFORE UPDATE ON loan_deviations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_sanctions_updated_at
  BEFORE UPDATE ON loan_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_loan_disbursements_updated_at
  BEFORE UPDATE ON loan_disbursements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log stage changes
CREATE OR REPLACE FUNCTION log_loan_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
    INSERT INTO loan_stage_history (
      loan_application_id,
      from_stage,
      to_stage,
      moved_by
    ) VALUES (
      NEW.id,
      OLD.current_stage,
      NEW.current_stage,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_loan_stage_change
  AFTER UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION log_loan_stage_change();