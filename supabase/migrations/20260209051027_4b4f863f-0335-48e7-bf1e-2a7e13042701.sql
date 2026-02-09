-- First, delete videokyc_recordings that reference these applications
DELETE FROM public.videokyc_recordings WHERE application_id IN (SELECT id FROM public.loan_applications WHERE created_at <= '2026-01-31 23:59:59+00');

-- Now delete the loan applications (cascades to all other child tables)
DELETE FROM public.loan_applications WHERE created_at <= '2026-01-31 23:59:59+00';