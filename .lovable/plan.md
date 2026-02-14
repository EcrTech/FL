
# Convert DRAFT-1771058869199 to Formal Loan Application

## Summary
Manually convert the stuck draft application to a formal loan application, same as was done for the previous draft.

## Verified Facts
- Application ID: `9b7c0e99-c3a0-47bc-ba1b-580cc9b237a4`
- Video KYC: Completed successfully on Feb 14, 2026 at 11:02 AM
- Recording: Available in storage
- Same root cause: Browser/network issue prevented the submission function from firing after Video KYC completion

## Action
Run a single database update to convert the draft:

```text
Application Number: DRAFT-1771058869199 -> LOAN-202602-00376
Current Stage:      video_kyc           -> application_login
Status:             in_progress         (unchanged)
```

## Technical Details
Execute this SQL update on the `loan_applications` table:

```sql
UPDATE loan_applications 
SET application_number = 'LOAN-202602-00376', 
    current_stage = 'application_login', 
    status = 'in_progress',
    updated_at = now()
WHERE id = '9b7c0e99-c3a0-47bc-ba1b-580cc9b237a4'
  AND application_number = 'DRAFT-1771058869199';
```

No code changes are required -- this is a data-only fix.
