

## Bulk Payment (BLKPAY) Excel Report Generator

### Overview
Add a "Bulk Payment Report" feature to the LOS Dashboard that generates an Excel file in the standard Indian bank NEFT/RTGS bulk payment format (BLKPAY_YYYYMMDD.xlsx). This report will pull data from disbursement-pending and disbursed loan applications and format it for direct upload to banking portals.

### Standard BLKPAY Format Columns
Based on the standard Indian bank bulk payment file format, the report will include:

| Column | Description | Data Source |
|---|---|---|
| Sr No | Serial number | Auto-generated |
| Transaction Type | NEFT / RTGS / IMPS | `loan_disbursements.payment_mode` |
| Beneficiary Name | Account holder name | `loan_applicants.bank_account_holder_name` |
| Beneficiary Account No | Bank account number | `loan_applicants.bank_account_number` |
| IFSC Code | Bank IFSC code | `loan_applicants.bank_ifsc_code` |
| Amount | Net disbursement amount | `loan_sanctions.net_disbursement_amount` |
| Loan ID | Loan reference number | `loan_applications.loan_id` or `application_number` |
| Email | Borrower email (optional) | `loan_applicants.email` |
| Mobile | Borrower mobile | `loan_applicants.mobile` |
| Remarks | Payment narration | Auto-generated (e.g., "LOAN DISB {application_number}") |

### Implementation

#### 1. Install `xlsx` package
The project currently only supports CSV export. To generate proper `.xlsx` files, we need the `xlsx` (SheetJS) library.

#### 2. Create `src/utils/bulkPaymentExport.ts`
A utility function that:
- Accepts an array of loan application data (with applicant, sanction, and disbursement details)
- Maps the data into the BLKPAY column format
- Generates an `.xlsx` file with the filename `BLKPAY_YYYYMMDD.xlsx` (using current date)
- Triggers a browser download

#### 3. Create `src/components/LOS/Reports/BulkPaymentReport.tsx`
A new component (accessible from the LOS Dashboard or a Reports section) that:
- Shows a date filter to select disbursement date range
- Queries `loan_applications` joined with `loan_applicants`, `loan_sanctions`, and `loan_disbursements` for applications in `disbursement_pending` or `disbursed` stage
- Displays a preview table of the data
- Has a "Download BLKPAY Report" button that generates and downloads the Excel file
- Includes status filter (e.g., only pending disbursements, or all)

#### 4. Add route and navigation
- Add a route at `/los/bulk-payment-report`
- Add a quick action button on the LOS Dashboard or in the sidebar navigation to access this report

### Technical Details

**File changes:**
| File | Action |
|---|---|
| `package.json` | Add `xlsx` dependency |
| `src/utils/bulkPaymentExport.ts` | New -- Excel generation utility |
| `src/components/LOS/Reports/BulkPaymentReport.tsx` | New -- Report UI with filters and preview |
| `src/pages/LOS/Dashboard.tsx` | Add quick action link to bulk payment report |
| Router config file | Add `/los/bulk-payment-report` route |

**Data query:** The report will join `loan_applications`, `loan_applicants` (primary), `loan_sanctions`, and `loan_disbursements` to gather all required fields in a single query.

**Note:** Since I could not read the uploaded Excel file directly, the column structure is based on the standard Indian bank bulk payment format. If your bank requires different or additional columns, we can adjust after you review the first output.

