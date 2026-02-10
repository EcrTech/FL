

## Race Condition and Parallel Process Audit

### Summary

After a thorough review of the entire codebase, I identified **12 distinct race condition / parallel process issues** across the LOS pipeline, referral flow, payments, and supporting systems. These are grouped by severity.

---

### CRITICAL (Data corruption / financial impact)

**1. Duplicate Sanction Creation (Sanctions.tsx + SanctionGenerator.tsx)**
- Two completely separate components can create sanctions for the same application:
  - `src/pages/LOS/Sanctions.tsx` (the queue page "Sanction" button)
  - `src/components/LOS/Sanction/SanctionGenerator.tsx` (the application detail page)
- Neither checks if a sanction was just created by the other. The Sanctions.tsx page checks `app.sanction_id` from its local query cache, but SanctionGenerator checks a separate query. If two users (or even the same user via two tabs) click sanction around the same time, two `loan_sanctions` records are created for the same application.
- **Both also set `current_stage`** independently, causing a last-write-wins race.
- Fix: Add a database unique constraint on `loan_application_id` in `loan_sanctions`, or use an upsert. Use a server-side function (edge function) for sanction creation instead of client-side mutations.

**2. EMI Payment Double-Recording (useEMIPayments.ts)**
- The `recordPaymentMutation` performs a read-then-write on `loan_repayment_schedule`:
  1. Reads `amount_paid` from the schedule
  2. Adds the new payment amount
  3. Writes back the new total
- If two payments are recorded simultaneously (e.g., a manual recording while a webhook also processes a UPI collection), the second write overwrites the first because the read happened before the first write completed.
- Fix: Use a database function with `UPDATE ... SET amount_paid = amount_paid + $1` to make the operation atomic. Same pattern exists in `src/hooks/useCollections.ts`.

**3. Disbursement Double-Creation (ProofUploadDialog.tsx)**
- When `disbursementId` is not provided, the component creates a new `loan_disbursements` record. There is no check for an existing disbursement before inserting.
- If a user clicks "Upload & Complete" twice quickly (before `isPending` disables the button), two disbursement records can be created.
- The button is disabled during `isPending`, but there is a window between click and the pending state being set.
- Fix: Add a unique constraint on `loan_application_id` in `loan_disbursements` (if only one disbursement per application), or use a server-side transaction.

**4. Application Number Collision (submit-loan-application edge function)**
- `generateApplicationNumber()` uses `Math.random()` to produce a 5-digit suffix: `LA-YYYYMM-XXXXX`
- With ~100,000 possible values per month, collisions become statistically likely at scale (birthday paradox: ~50% collision chance at ~300 applications/month).
- There is no unique constraint check or retry logic.
- Fix: Use a database sequence or `nextval()` for guaranteed uniqueness.

---

### HIGH (Workflow disruption / data inconsistency)

**5. Multi-Step Non-Atomic Stage Transitions (EligibilityCalculator.tsx)**
- The `approveMutation` calls `saveMutation.mutateAsync()` first, then updates the application stage. If the save succeeds but the stage update fails, the eligibility data is saved but the application is stuck in the wrong stage.
- The same pattern exists in `rejectMutation`.
- Fix: Combine both operations into a single edge function or database transaction.

**6. Concurrent Stage Writes From Multiple Components**
- The following components all write to `loan_applications.current_stage` independently:
  - `VerificationDashboard.tsx` (sets `credit_assessment`)
  - `EligibilityCalculator.tsx` (sets `approval_pending` or `rejected`)
  - `ApprovalActionDialog.tsx` (sets `sanctioned` or `rejected`)
  - `Sanctions.tsx` (sets `disbursement_pending`)
  - `SanctionGenerator.tsx` (sets `disbursement_pending`)
  - `ProofUploadDialog.tsx` (sets `disbursed`)
- None of these include a `WHERE current_stage = 'expected_previous_stage'` guard. Any of them can overwrite a stage transition made by another process. For example, if a user is on the Sanctions page and another user rejects the application via ApprovalActionDialog, the sanction mutation can still succeed and overwrite the rejection.
- Fix: Add conditional updates: `.eq("current_stage", expectedPreviousStage)` to every stage transition, and check `data` count to confirm the update actually happened.

**7. Draft Application Orphans (ReferralLoanApplication.tsx)**
- The `createDraftApplication` function creates a database record before Video KYC. If the user abandons, a DRAFT record remains.
- Additionally, if the user clicks "Next" to enter Video KYC multiple times (e.g., due to slow network), multiple draft applications can be created since `draftApplicationId` is set asynchronously after the function returns.
- This was already identified and a plan was proposed but not yet implemented.

**8. Disbursals Page N+1 Query Race (Disbursals.tsx)**
- The Disbursals page runs individual queries inside a `for` loop for each application (lines 98-161): fetching documents, checking existing disbursements, fetching applicant info, and fetching bank details -- 4 sequential queries per application.
- This creates a waterfall of queries that can take seconds. During this time, if data changes (e.g., someone creates a disbursement), the final unified list can contain stale/contradictory data (e.g., showing an application as "ready" when a disbursement was just created).
- Fix: Refactor to use JOINs or a single database function/view instead of N+1 client-side queries.

---

### MEDIUM (UI inconsistency / minor data issues)

**9. Dashboard Stats Use Stale Stage Values (Dashboard.tsx)**
- The LOS Dashboard counts applications using `Promise.all` with stage filters like `["approved", "disbursement_pending"]` for the "Pending Approval" card. But after the recent fix, the assessor now sets `approval_pending` instead of `approved`. The dashboard filter still references `"approved"` which is now only set by the approver.
- This means the dashboard counter may not accurately reflect in-flight applications.
- Fix: Update the dashboard filters to match the corrected stage values. Consider using a centralized stage constants file.

**10. Sanction Number / Disbursement Number Uniqueness**
- Sanction numbers use `SAN-${Date.now().toString(36)}` and disbursement numbers use `DISB${Date.now()}`. These are timestamp-based and not guaranteed unique if two operations happen within the same millisecond.
- Fix: Use database sequences or UUIDs for these identifiers.

**11. Auth Context Parallel Fetches (AuthContext.tsx)**
- On sign-in, `Promise.all` fetches role, org, and permissions simultaneously. If any one fails, the destructured result may contain undefined values, but the error handling only checks individual results. A network timeout on one could leave the auth state partially populated.
- This was already partially addressed per the memory notes about the `pendingSignInUser` pattern.

**12. Income Summary Upsert Race (IncomeSummary.tsx)**
- The save mutation does a read-then-write pattern: checks if an existing record exists, then either updates or inserts. If two users save simultaneously, two inserts can occur (both see no existing record).
- Fix: Use a Postgres `ON CONFLICT ... DO UPDATE` (upsert) pattern.

---

### Recommended Fixes Priority

| Priority | Issue | Fix Approach | Effort |
|----------|-------|-------------|--------|
| P0 | #1 Duplicate sanctions | DB unique constraint + upsert | Low |
| P0 | #2 EMI payment double-count | Atomic DB update (`amount_paid + $1`) | Low |
| P0 | #4 Application number collision | DB sequence | Low |
| P0 | #6 Concurrent stage writes | Add `WHERE current_stage = expected` guards | Medium |
| P1 | #3 Disbursement double-creation | DB unique constraint | Low |
| P1 | #5 Non-atomic stage transitions | Edge function / DB transaction | Medium |
| P1 | #9 Dashboard stale stage values | Update filter constants | Low |
| P2 | #7 Draft orphans | Already planned (temp session ID) | Medium |
| P2 | #8 Disbursals N+1 | Database view / single query | Medium |
| P2 | #10 Identifier uniqueness | DB sequences | Low |
| P3 | #11 Auth parallel fetch | Better error boundaries | Low |
| P3 | #12 Income summary upsert | ON CONFLICT clause | Low |

---

### Technical Root Cause

The core architectural issue is that **stage transitions and record creation are performed client-side without optimistic locking or database-level guards**. Every mutation trusts that the UI state is current and does not verify preconditions at the database level. This means any two concurrent operations (two users, two tabs, double-clicks, webhook + manual action) can create conflicting state.

The recommended systemic fix is to:
1. Add unique constraints on one-to-one relationships (sanctions, disbursements per application)
2. Add conditional `WHERE` clauses on all stage transitions
3. Use atomic database operations (increment, upsert) instead of read-then-write patterns
4. Centralize stage constants and transition rules in a shared module

