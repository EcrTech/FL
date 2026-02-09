

## Replace Loan Agreement with Final Legal Document

The uploaded PDF contains the **exact legal text** for the Loan Agreement. The current `LoanAgreementDocument.tsx` has paraphrased/rewritten legal language that must be replaced with the verbatim text from the uploaded document, keeping only the yellow-highlighted fields as dynamic variables.

The Sanction Letter, Repayment Schedule, and KFS remain unchanged.

---

### Yellow-Highlighted Variable Fields (from the uploaded PDF)

Here is the complete field-by-field mapping of every dynamic field in the agreement:

| # | Variable Field (Yellow) | Location in PDF | Database Source | Status |
|---|---|---|---|---|
| 1 | Borrower Name (e.g. "Mr. Anupam Roy") | Page 1 - Parties, Page 6 - Schedule, Signature | `loan_applicants.first_name + last_name` | Already available |
| 2 | PAN Number (e.g. "AMKPR9180Q") | Page 1 - Borrower para | `loan_applicants.pan_number` | Already available (passed as `borrowerPAN`) |
| 3 | Borrower Address | Page 1 - Borrower para | `loan_applicants` address fields | Already available |
| 4 | Borrower Email | Page 1 - Borrower para | `loan_applicants.email` | **NEW** - needs to be added to props |
| 5 | Borrower Phone | Page 1 - Borrower para | `loan_applicants.phone` | Already available |
| 6 | Agreement/Execution Date (e.g. "07/02/2026") | Page 5 - IN WHEREOF, Page 6 - Schedule | `documentDate` prop | Already available |
| 7 | Loan ID Number | Page 6 - Schedule row 1 | `documentNumber` prop | Already available |
| 8 | Principal Loan Amount | Page 6 - Schedule row 7 | `loanAmount` prop | Already available |
| 9 | Tenure in Days | Page 6 - Schedule row 8 | `tenureDays` prop | Already available |
| 10 | Rate of Interest (1.00 Per Day) | Page 6 - Schedule row 9 | `interestRate` prop | Already available |
| 11 | Processing Fees | Page 6 - Schedule row 10 | `processingFee` prop | Already available |
| 12 | GST | Page 6 - Schedule row 12 | `gstOnProcessingFee` prop | Already available |
| 13 | Amount to be Disbursed | Page 6 - Schedule row 13 | `netDisbursal` prop | Already available |
| 14 | Due Date | Page 6 - Schedule row 14 | `dueDate` prop | Already available |
| 15 | Repayment Amount | Page 6 - Schedule row 15 | `totalRepayment` prop | Already available |

---

### What Changes

**Only 1 file is rewritten:** `src/components/LOS/Sanction/templates/LoanAgreementDocument.tsx`

The entire legal body text will be replaced with the **exact verbatim text** from the uploaded PDF (pages 1-6). The structure becomes:

1. **Page 1**: Title, BY AND BETWEEN (Lender para with company details, Borrower para with highlighted fields), Witnesseth clauses (exact text from PDF)
2. **Page 2**: Commencement, Borrower Acknowledgements (4 numbered items - exact text), Borrower Undertaking (exact text)
3. **Page 3**: Continuation of Borrower Undertaking, Representations and Warranties, Disbursement, Repayment
4. **Page 4**: Events of Default (5 bullet items - exact text), Consequence of Default, Notices, Severability
5. **Page 5**: Governing Law (Jurisdiction: New Delhi), Binding Effect, Entire Agreement, Miscellaneous (Language, Cumulative Rights, Benefit), Acceptance, IN WHEREOF with execution date
6. **Page 6**: SCHEDULE OF LOAN DETAILS AND TERMS (table with all 15 rows), Signature blocks

**1 prop added:** `borrowerEmail` (string, optional) to `LoanAgreementDocument` and `CombinedLoanDocuments`

**1 additional file updated:** `src/components/LOS/Sanction/templates/CombinedLoanDocuments.tsx` - pass `borrowerEmail` prop through

**2 caller files updated:** `DisbursementDashboard.tsx` and `CombinedLoanPackCard.tsx` - pass `applicant?.email` as `borrowerEmail`

---

### What Does NOT Change

- `SanctionLetterDocument.tsx` - no changes
- `DailyRepaymentScheduleDocument.tsx` - no changes
- `KeyFactStatementDocument.tsx` - no changes
- All financial calculation logic - no changes
- Database schema - no changes needed (all fields already exist)

---

### Technical Details

The key structural differences between the current and final agreement:

| Aspect | Current (Paraphrased) | Final (Uploaded PDF) |
|---|---|---|
| Lender description | Short name + CIN + address | Full legal para with CIN, Companies Act ref, corporate office |
| Borrower description | Name, address, phone, PAN in card layout | Single paragraph with Mr./Ms., PAN, address, email, phone |
| Witnesseth | Generic NBFC language | Specific paisaasaarthi.com platform reference |
| Borrower Acknowledgements | 4 rewritten points | 4 specific points referencing "the App" and consent details |
| Borrower Undertaking | 4 bullet items | Detailed paragraphs about CIBIL, TRAI, KYC, etc. |
| Disbursement | Mentions deductions | Simple "within 2 working days" |
| Repayment | 5 detailed bullet points | Single paragraph about full repayment + eMandate/ENACH |
| Events of Default | 5 rewritten points | 5 points including eMandate/ENACH/PDC specifics |
| Consequence of Default | Summary paragraph | Specific mention of Section 25 Payment Settlement Act 2007 |
| Jurisdiction | Configurable (default Mumbai) | Fixed: "New Delhi, Delhi" |
| Execution | Witness section with 2 witnesses | Authorized Signatory + Applicant Signature/ESIGN blocks |
| Schedule table | 12 rows | 15 rows (adds GST as separate row, numbered SN column) |

