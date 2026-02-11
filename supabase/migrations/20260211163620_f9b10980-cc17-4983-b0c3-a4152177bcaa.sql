-- Restore the dropped policy
CREATE POLICY "Users can view approvals in their org"
ON public.loan_approvals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM loan_applications
    WHERE loan_applications.id = loan_approvals.loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  )
);

-- Add INSERT policy via application join
CREATE POLICY "Users can create approvals"
ON public.loan_approvals FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM loan_applications
    WHERE loan_applications.id = loan_application_id
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  )
);