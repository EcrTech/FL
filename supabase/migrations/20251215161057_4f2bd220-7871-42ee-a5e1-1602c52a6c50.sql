-- Add missing columns to store calculated loan values (single source of truth)
ALTER TABLE loan_eligibility 
  ADD COLUMN IF NOT EXISTS total_interest NUMERIC,
  ADD COLUMN IF NOT EXISTS total_repayment NUMERIC,
  ADD COLUMN IF NOT EXISTS daily_emi NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN loan_eligibility.total_interest IS 'Calculated total interest: principal * (daily_rate/100) * tenure_days';
COMMENT ON COLUMN loan_eligibility.total_repayment IS 'Total repayment amount: principal + total_interest';
COMMENT ON COLUMN loan_eligibility.daily_emi IS 'Daily EMI: total_repayment / tenure_days';