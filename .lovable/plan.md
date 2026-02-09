
## Clean Up: Remove Draft and Test Applications

### What Will Be Deleted

**All draft applications (22 records)** -- these are incomplete submissions stuck at the video KYC stage with no real data.

**Saman Heyat Khan (2 applications)**
- LA-202602-65110
- LA-202501-51486

**Sonu Kumar (1 application)**
- LA-202602-12597

**Abhishek Singh (2 applications)**
- LA-202512-89533
- LA-202601-49047

**Total: ~27 applications removed**

### Approach

A single database migration will delete all related child records across these tables (in dependency order) before deleting the parent `loan_applications` rows:

1. `loan_repayment_schedule`
2. `loan_payments`
3. `loan_disbursements`
4. `loan_sanctions`
5. `loan_approvals`
6. `loan_deviations`
7. `loan_eligibility`
8. `loan_credit_bureau_reports`
9. `loan_bank_analysis`
10. `loan_income_summaries`
11. `loan_employment_details`
12. `loan_documents`
13. `loan_generated_documents`
14. `loan_verifications`
15. `loan_referrals`
16. `loan_stage_history`
17. `loan_audit_log`
18. `loan_application_forms`
19. `loan_applicants`
20. `loan_applications` (parent)

The SQL will first collect all matching application IDs into a CTE, then delete from each child table where `loan_application_id` is in that set, and finally delete the parent rows.

### Technical Details

```sql
-- Collect target application IDs
WITH target_apps AS (
  SELECT la.id FROM loan_applications la
  LEFT JOIN loan_applicants ap ON ap.loan_application_id = la.id AND ap.applicant_type = 'primary'
  WHERE la.status = 'draft'
     OR LOWER(ap.first_name) IN ('saman', 'sonu', 'abhishek')
)
-- Delete from each child table, then parent
DELETE FROM loan_repayment_schedule WHERE loan_application_id IN (SELECT id FROM target_apps);
-- ... repeat for all child tables ...
DELETE FROM loan_applications WHERE id IN (SELECT id FROM target_apps);
```

### Files Changed

| File | Change |
|---|---|
| Database migration | Single SQL migration to cascade-delete all 27 applications and their related records |

No code file changes are needed -- this is purely a data cleanup operation.
