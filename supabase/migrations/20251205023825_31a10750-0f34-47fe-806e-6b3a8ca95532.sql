-- Create loan_income_summaries table for storing computed income data
CREATE TABLE IF NOT EXISTS loan_income_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES loan_applicants(id) ON DELETE SET NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Monthly income from salary slips
  monthly_gross_salary NUMERIC,
  monthly_net_salary NUMERIC,
  monthly_deductions NUMERIC,
  
  -- Year 1 income data (Form 16/ITR)
  year_1_label VARCHAR(20),
  year_1_gross_income NUMERIC,
  year_1_taxable_income NUMERIC,
  year_1_tax_paid NUMERIC,
  year_1_source VARCHAR(20),
  
  -- Year 2 income data (Form 16/ITR)
  year_2_label VARCHAR(20),
  year_2_gross_income NUMERIC,
  year_2_taxable_income NUMERIC,
  year_2_tax_paid NUMERIC,
  year_2_source VARCHAR(20),
  
  -- Computed summaries
  average_monthly_income NUMERIC,
  annual_average_income NUMERIC,
  income_growth_percentage NUMERIC,
  income_stability_score VARCHAR(20),
  
  -- Salary slip details (JSON array)
  salary_slip_details JSONB DEFAULT '[]'::jsonb,
  
  -- Document references
  source_documents JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(loan_application_id)
);

-- Enable RLS
ALTER TABLE loan_income_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view income summaries in their org"
ON loan_income_summaries FOR SELECT
USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert income summaries in their org"
ON loan_income_summaries FOR INSERT
WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update income summaries in their org"
ON loan_income_summaries FOR UPDATE
USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role can manage income summaries"
ON loan_income_summaries FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_loan_income_summaries_updated_at
BEFORE UPDATE ON loan_income_summaries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();