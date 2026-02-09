

## Delete All Loan Applications Created On or Before January 31, 2026

### What will happen

A database migration will permanently delete **157 loan applications** created on or before January 31, 2026, along with all their related data.

### Related data that will be auto-deleted (via CASCADE)

The following child records linked to these applications will also be removed automatically:

- Loan applicants
- Loan documents
- Loan verifications
- Loan eligibility records
- Loan approvals
- Loan deviations
- Loan sanctions
- Loan disbursements
- Loan stage history
- Loan audit logs
- Loan repayment schedules
- Loan payments
- Loan income summaries
- Generated documents
- Document e-sign requests
- NuPay UPI transactions
- NuPay mandates
- Loan referrals

A few tables (SMS messages, SMS automation executions, call logs) will have their `loan_application_id` set to NULL (not deleted), and video KYC recordings will retain their reference as-is.

### Technical Details

| Item | Detail |
|---|---|
| Migration SQL | `DELETE FROM public.loan_applications WHERE created_at <= '2026-01-31 23:59:59+00';` |
| Records affected | 157 loan applications + all cascaded child records |
| Irreversible | Yes -- this cannot be undone |

### Important: Live Environment

This migration will run against the **test** database. If you also need this applied to the **live/production** database, you will need to run the same SQL in the Cloud View with Live selected after publishing.

