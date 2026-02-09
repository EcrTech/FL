

## Remove 4 Marked Loan Applications

### Cases to Delete

| Loan ID | Applicant | Stage | Related Records |
|---------|-----------|-------|-----------------|
| LOAN-202602-00367 | Aman Kharbanda | Disbursement Pending | 1 applicant, 1 sanction, 1 eligibility, 7 documents |
| LOAN-202602-00356 | Aman Kharbanda | Application Login | 1 applicant |
| LOAN-202602-00354 | ZEBA | Application Login | 1 applicant, 2 documents |
| LOAN-202602-00352 | shivam kumar | Disbursement Pending | 1 applicant, 1 sanction, 1 eligibility, 1 referral, 17 documents |

### Action

Run a database migration that deletes all child records first (due to foreign key constraints), then the parent loan applications:

1. Delete from `loan_documents`
2. Delete from `loan_referrals`
3. Delete from `loan_eligibility`
4. Delete from `loan_sanctions`
5. Delete from `loan_applicants`
6. Delete from `loan_applications`

All deletes filtered by the 4 application IDs. No code changes needed -- this is a data-only operation.

### Important Note

This deletion is permanent and affects the **test environment**. If these records also exist in the live/production environment, you would need to run the same SQL there separately.
