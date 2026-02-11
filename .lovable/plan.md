

## Fix: Loans and Clients Tabs -- Apply Correct Business Logic and Fix Remaining Query Error

### Problem Summary

1. **Loans tab shows nothing** -- The current filter shows all applications with a `loan_id`, but a `loan_id` is assigned at many early stages (application_login, video_kyc, etc.). These are not actual loans. Per business logic, a "loan" only exists after disbursement. Additionally, the query itself may be returning too many irrelevant records.

2. **Clients tab shows nothing** -- The previous fix removed `customer_id` from the code, but the network logs confirm the browser is still sending a request with `customer_id`, resulting in a 400 error. This is likely a stale build issue. However, there's also a business logic problem: the Clients tab currently shows all applicants regardless of loan status. A "client" should only be someone with at least one disbursed loan.

3. **Business rule**: A person becomes a "client" only after a loan is disbursed, not before.

### Fixes

**File: `src/hooks/useLoansList.ts`**
- Change the filter from `app.loan_id !== null` to `app.current_stage === 'disbursed'`
- This ensures only truly disbursed loans appear in the Loans tab
- Add `current_stage` to the select query (it's currently missing)

**File: `src/hooks/useCustomerRelationships.ts`**
- Confirm `customer_id` is removed (already done in previous edit -- verify deployment)
- Add a post-query filter: only include customers who have at least one application with `current_stage === 'disbursed'`
- This ensures only actual clients (with disbursed loans) appear in the Clients tab
- Update the empty state message to say "Clients will appear here once loans are disbursed"

### Technical Details

1. **`src/hooks/useLoansList.ts`**:
   - Add `current_stage` to the select string on the `loan_applications` query
   - Line 88: Change `.filter((app: any) => app.loan_id !== null)` to `.filter((app: any) => app.current_stage === 'disbursed')`

2. **`src/hooks/useCustomerRelationships.ts`**:
   - After building `relationships` array (around line 371), filter to only include customers who have at least one application with `currentStage === 'disbursed'`
   - Add: `const clients = relationships.filter(r => r.applications.some(a => a.currentStage === 'disbursed'));`
   - Return `clients` instead of `relationships`

3. **`src/components/LOS/Relationships/ClientsTab.tsx`**:
   - Update empty state message (line 256) from "Customer relationships will appear here once loan applications are created" to "Clients will appear here once loans are disbursed"

