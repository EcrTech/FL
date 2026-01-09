-- Drop and recreate the loan_applicants management policy with proper WITH CHECK for INSERT
DROP POLICY IF EXISTS "Users can manage loan applicants" ON public.loan_applicants;

CREATE POLICY "Users can manage loan applicants" 
ON public.loan_applicants 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM loan_applications 
    WHERE loan_applications.id = loan_applicants.loan_application_id 
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM loan_applications 
    WHERE loan_applications.id = loan_applicants.loan_application_id 
    AND loan_applications.org_id = get_user_org_id(auth.uid())
  )
);