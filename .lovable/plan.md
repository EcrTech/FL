

## Collections Page Updates

### Changes Overview

1. **Remove EMI # column** from the table (since the process is ADHO, not sequential EMIs)
2. **Rename "EMI Amt" to "Due Amount"** in the table header
3. **Add "UTR Number" column** to display the transaction reference from payment records
4. **Add CSV Upload** feature with fields: Loan ID, Applicant, Paid, UTR Number

### Technical Details

**File: `src/components/LOS/Collections/CollectionsTable.tsx`**
- Remove the `EMI #` table header and its corresponding `TableCell`
- Rename `EMI Amt` header to `Due Amount`
- Add a `UTR Number` column that displays `transaction_reference` from the linked payment record
- Update `colSpan` for the empty state row

**File: `src/hooks/useCollections.ts`**
- Update the `CollectionRecord` interface: remove `emi_number`, add `utr_number`
- Update the query to join `loan_payments` and retrieve `transaction_reference` for each schedule entry
- The `loan_payments` table already has a `transaction_reference` column and `schedule_id` foreign key, so we can fetch this data

**File: `src/components/LOS/Collections/RecordPaymentDialog.tsx`**
- Remove EMI # reference from the summary section (line showing "EMI #X")
- Rename label to "Due Amount" instead of referencing EMI

**New File: `src/components/LOS/Collections/CSVUploadDialog.tsx`**
- Dialog with a file upload input accepting `.csv` files
- Expected CSV columns: `Loan ID`, `Applicant`, `Paid`, `UTR Number`
- Parse CSV using `papaparse` (already installed)
- Show preview table of parsed rows before submission
- On confirm, match each row by `loan_id` to the corresponding repayment schedule entry, then call `recordPayment` for each matched row
- Display success/error summary after processing

**File: `src/pages/LOS/Collections.tsx`**
- Add a "CSV Upload" button in the header area next to the title
- Wire up the new `CSVUploadDialog` component

### Data Flow for CSV Upload

1. User uploads CSV with columns: Loan ID, Applicant, Paid, UTR Number
2. System parses and displays preview
3. On confirm, for each row:
   - Find the pending/overdue schedule entry matching the Loan ID
   - Record payment with the amount from "Paid" and UTR from "UTR Number"
4. Show results summary (how many succeeded, any failures)

