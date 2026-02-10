
-- P0 #1: Prevent duplicate sanctions per application
ALTER TABLE public.loan_sanctions
ADD CONSTRAINT unique_loan_application_sanction UNIQUE (loan_application_id);

-- P1 #3: Prevent duplicate disbursements per application
ALTER TABLE public.loan_disbursements
ADD CONSTRAINT unique_loan_application_disbursement UNIQUE (loan_application_id);

-- P0 #2: Atomic payment recording function (prevents read-then-write race)
CREATE OR REPLACE FUNCTION public.record_emi_payment_atomic(
  p_schedule_id UUID,
  p_payment_amount NUMERIC,
  p_payment_date TEXT
)
RETURNS TABLE(new_amount_paid NUMERIC, new_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_emi NUMERIC;
  v_new_amount NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Atomic increment using UPDATE ... RETURNING
  UPDATE loan_repayment_schedule
  SET amount_paid = COALESCE(amount_paid, 0) + p_payment_amount,
      payment_date = CASE
        WHEN COALESCE(amount_paid, 0) + p_payment_amount >= total_emi THEN p_payment_date
        ELSE payment_date
      END
  WHERE id = p_schedule_id
  RETURNING total_emi, amount_paid INTO v_total_emi, v_new_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule item not found: %', p_schedule_id;
  END IF;

  -- Determine new status
  IF v_new_amount >= v_total_emi THEN
    v_new_status := 'paid';
  ELSIF v_new_amount > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Update status
  UPDATE loan_repayment_schedule
  SET status = v_new_status
  WHERE id = p_schedule_id;

  new_amount_paid := v_new_amount;
  new_status := v_new_status;
  RETURN NEXT;
END;
$$;

-- P0 #6: Guarded stage transition function (prevents concurrent overwrites)
CREATE OR REPLACE FUNCTION public.transition_loan_stage(
  p_application_id UUID,
  p_expected_current_stage TEXT,
  p_new_stage TEXT,
  p_new_status TEXT DEFAULT NULL,
  p_approved_by UUID DEFAULT NULL,
  p_approved_amount NUMERIC DEFAULT NULL,
  p_tenure_days INTEGER DEFAULT NULL,
  p_interest_rate NUMERIC DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_affected INTEGER;
BEGIN
  UPDATE loan_applications
  SET current_stage = p_new_stage,
      status = COALESCE(p_new_status, status),
      approved_by = COALESCE(p_approved_by, approved_by),
      approved_amount = COALESCE(p_approved_amount, approved_amount),
      tenure_days = COALESCE(p_tenure_days, tenure_days),
      interest_rate = COALESCE(p_interest_rate, interest_rate),
      updated_at = now()
  WHERE id = p_application_id
    AND current_stage = p_expected_current_stage;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected > 0;
END;
$$;

-- P0 #4: Application number sequence for guaranteed uniqueness
CREATE SEQUENCE IF NOT EXISTS public.loan_application_number_seq START WITH 10001;

-- P2 #10: Sanction number sequence
CREATE SEQUENCE IF NOT EXISTS public.loan_sanction_number_seq START WITH 1001;

-- P2 #10: Disbursement number sequence  
CREATE SEQUENCE IF NOT EXISTS public.loan_disbursement_number_seq START WITH 1001;

-- P12: Add unique constraint on income summaries to prevent duplicates
ALTER TABLE public.loan_income_summaries
ADD CONSTRAINT unique_loan_application_income_summary UNIQUE (loan_application_id);
