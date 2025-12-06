-- Rename tenure_months to tenure_days in loan_applications
ALTER TABLE public.loan_applications RENAME COLUMN tenure_months TO tenure_days;

-- Update existing data: convert months to days (multiply by 30)
UPDATE public.loan_applications SET tenure_days = tenure_days * 30 WHERE tenure_days IS NOT NULL;

-- Rename approved_tenure to approved_tenure_days in loan_approvals
ALTER TABLE public.loan_approvals RENAME COLUMN approved_tenure TO approved_tenure_days;

-- Update existing data in loan_approvals
UPDATE public.loan_approvals SET approved_tenure_days = approved_tenure_days * 30 WHERE approved_tenure_days IS NOT NULL;

-- Rename recommended_tenure to recommended_tenure_days in loan_eligibility
ALTER TABLE public.loan_eligibility RENAME COLUMN recommended_tenure TO recommended_tenure_days;

-- Update existing data in loan_eligibility
UPDATE public.loan_eligibility SET recommended_tenure_days = recommended_tenure_days * 30 WHERE recommended_tenure_days IS NOT NULL;

-- Rename sanctioned_tenure to sanctioned_tenure_days in loan_sanctions
ALTER TABLE public.loan_sanctions RENAME COLUMN sanctioned_tenure TO sanctioned_tenure_days;

-- Update existing data in loan_sanctions
UPDATE public.loan_sanctions SET sanctioned_tenure_days = sanctioned_tenure_days * 30 WHERE sanctioned_tenure_days IS NOT NULL;

-- Rename min_tenure and max_tenure in loan_products
ALTER TABLE public.loan_products RENAME COLUMN min_tenure TO min_tenure_days;
ALTER TABLE public.loan_products RENAME COLUMN max_tenure TO max_tenure_days;

-- Update existing data in loan_products
UPDATE public.loan_products SET min_tenure_days = min_tenure_days * 30 WHERE min_tenure_days IS NOT NULL;
UPDATE public.loan_products SET max_tenure_days = max_tenure_days * 30 WHERE max_tenure_days IS NOT NULL;