

## Fix: Loans and Clients Tabs Not Showing Data

### Root Causes Found

**Issue 1 -- Clients Tab: Invalid column reference**
The `useCustomerRelationships` hook (line 220) requests `customer_id` from `loan_applications`, but this column does not exist in the table. This causes a PostgREST 400 error, silently returning no data.

**Issue 2 -- Loans Tab: No disbursement records**
The `useLoansList` hook filters results with `app.loan_disbursements?.length > 0`. Only one application (`d7491e36` / LA-202602-80732) has a disbursement record in the database. However, it should appear. The likely issue is that the query may be silently failing or the single record is not passing through. Since the hook uses `!inner` join on `loan_applicants`, and this applicant exists, the real problem may be that loans with `loan_id` set but no disbursement yet (like approved/sanctioned loans) should also appear in the Loans tab -- but the filter excludes them.

### Fixes

**File: `src/hooks/useCustomerRelationships.ts`**
- Remove `customer_id` from the select query on line 220 (column does not exist)

**File: `src/hooks/useLoansList.ts`**
- No code change needed for the query itself -- the disbursed loan should appear. But we should also consider showing loans that have a `loan_id` and are at `disbursement_pending` or `disbursed` stage, not just ones with disbursement records. This makes the Loans tab useful for tracking loans that are approved but awaiting disbursement.
- Remove the strict `.filter((app) => app.loan_disbursements?.length > 0)` requirement and instead show all applications with a `loan_id`, marking those without disbursements as "pending disbursement"

### Technical Details

1. In `useCustomerRelationships.ts` line 220: delete `customer_id,` from the select string
2. In `useLoansList.ts` line 88: change the filter to not require disbursements, and adjust the mapping to handle missing disbursement data gracefully (show 0 for disbursed amount, null for disbursement date)

