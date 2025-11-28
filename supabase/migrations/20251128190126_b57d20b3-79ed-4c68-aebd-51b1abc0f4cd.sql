-- Create loan repayment schedule table
CREATE TABLE IF NOT EXISTS public.loan_repayment_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  sanction_id UUID NOT NULL REFERENCES public.loan_sanctions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  emi_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_amount NUMERIC(12, 2) NOT NULL,
  interest_amount NUMERIC(12, 2) NOT NULL,
  total_emi NUMERIC(12, 2) NOT NULL,
  outstanding_principal NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'partially_paid')),
  payment_date DATE,
  amount_paid NUMERIC(12, 2) DEFAULT 0,
  late_fee NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create loan payments table
CREATE TABLE IF NOT EXISTS public.loan_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.loan_repayment_schedule(id) ON DELETE SET NULL,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL UNIQUE,
  payment_date DATE NOT NULL,
  payment_amount NUMERIC(12, 2) NOT NULL,
  principal_paid NUMERIC(12, 2) NOT NULL,
  interest_paid NUMERIC(12, 2) NOT NULL,
  late_fee_paid NUMERIC(12, 2) DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'neft', 'rtgs', 'imps', 'upi', 'card')),
  transaction_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_loan_app ON public.loan_repayment_schedule(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_due_date ON public.loan_repayment_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_status ON public.loan_repayment_schedule(status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_app ON public.loan_payments(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_schedule ON public.loan_payments(schedule_id);

-- Enable RLS
ALTER TABLE public.loan_repayment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loan_repayment_schedule
CREATE POLICY "Users can view repayment schedules in their org"
ON public.loan_repayment_schedule
FOR SELECT
TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admins can manage repayment schedules"
ON public.loan_repayment_schedule
FOR ALL
TO authenticated
USING (
  org_id = public.get_user_org_id(auth.uid()) 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
)
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Service role can manage all schedules"
ON public.loan_repayment_schedule
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policies for loan_payments
CREATE POLICY "Users can view payments in their org"
ON public.loan_payments
FOR SELECT
TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can create payments"
ON public.loan_payments
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admins can manage payments"
ON public.loan_payments
FOR ALL
TO authenticated
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
)
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Service role can manage all payments"
ON public.loan_payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_emi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_repayment_schedule_updated_at
BEFORE UPDATE ON public.loan_repayment_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_emi_updated_at();

CREATE TRIGGER update_loan_payments_updated_at
BEFORE UPDATE ON public.loan_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_emi_updated_at();