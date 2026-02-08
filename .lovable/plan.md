

## Combined Loan Pack Overhaul

This plan addresses all discrepancies between the current generated documents and the reference DOCX, aligning the Sanction Letter, Loan Agreement, and Daily Repayment Schedule with your business model (1% daily flat rate, bullet repayment, short-term tenure).

---

### Summary of All Discrepancies Found

| Area | Current (Wrong) | Required (Reference DOCX) |
|------|-----------------|--------------------------|
| **Sanction Letter - Rate** | `{interestRate}% p.a. (Reducing Balance)` | `1% per day (Flat basis)` |
| **Sanction Letter - Tenure** | `{tenure} Months` | `{tenureDays} Days` |
| **Sanction Letter - EMI row** | Shows "EMI Amount" (monthly) | Should show "Repayment Amount" (total: Rs.11,700) |
| **Sanction Letter - Missing rows** | No GST, no Net Disbursal, no Total Interest breakdown | Must show GST, Processing Fee + GST combined, Net Disbursal, Interest Amount, Total Repayment |
| **Loan Agreement - Body** | 8 short articles, generic monthly EMI language | Full legal text from DOCX: Commencement, Borrower Acknowledgements, Undertaking, Representations, Disbursement, Repayment (bullet), Events of Default, Notices, Severability, Governing Law, Binding Effect, Miscellaneous, Acceptance |
| **Loan Agreement - Schedule** | Table shows `% p.a. (Reducing Balance)`, `{tenure} months`, `EMI Amount` | Schedule table must show: Rate = `1% Per Day`, Tenure = `30 Days`, Processing Fee, GST, Amount to be Disbursed, Due Date, Repayment Amount |
| **Loan Agreement - Rate** | `{interestRate}% per annum (Reducing Balance)` | `1.00 Per Day` |
| **Daily Schedule - Model** | EMI-based (splits total into equal daily payments) | Accrual-based (shows what borrower owes if repaid on any given day) |
| **Daily Schedule - Columns** | Day, Due Date, Daily EMI, Cumulative Paid, Balance | Day, Date, Daily Interest, Interest Accrued, Total Amount Due |
| **Daily Schedule - "Daily EMI" row** | Shows daily EMI in summary | Remove; show only Total Interest and Total Repayment |
| **Combined Pack - dailyInterestRate** | Passed as `interestRate / 365` | Must pass `interestRate` directly (already 1% daily) |
| **Combined Pack - Missing doc** | No Key Fact Statement (KFS) | Must add KFS with Annex A, Annex B, Annex C |
| **DisbursementDashboard - monthlyEMI** | Uses `calculateEMI()` with reducing balance formula | Remove monthly EMI calculation; use stored `dailyEMI` from eligibility |

---

### File-by-File Changes

#### 1. `src/components/LOS/Sanction/templates/SanctionLetterDocument.tsx`

- Change "Rate of Interest" row from `{interestRate}% p.a. (Reducing Balance)` to `{interestRate}% per day (Flat)`
- Change "Loan Tenure" row from `{tenure} Months` to `{tenureDays} Days`
- Replace "EMI Amount" row with "Repayment Amount" showing total repayment (principal + interest)
- Add new rows: Total Interest, GST on Processing Fee, Net Disbursal Amount, Due Date
- Add new props: `tenureDays`, `totalInterest`, `totalRepayment`, `netDisbursal`, `dueDate`
- Update "Next Steps" to remove "Set up EMI auto-debit" and reference bullet repayment instead
- Match the reference sanction letter structure from DOCX pages 7-8

#### 2. `src/components/LOS/Sanction/templates/LoanAgreementDocument.tsx`

- **Replace the entire agreement body** with the full legal text from the uploaded DOCX:
  - Witnesseth clause (referencing the platform and NBFC)
  - Borrower Acknowledgements and Confirmation (4 numbered points)
  - Borrower Undertaking (authorization, consent, communications clauses)
  - Representations and Warranties
  - Disbursement of the Loan
  - Repayment of the Loan (bullet payment language, not monthly EMI)
  - Events of Default (5 specific events matching DOCX)
  - Consequence of Default
  - Notices, Severability, Governing Law, Binding Effect, Entire Agreement
  - Miscellaneous (Language, Cumulative Rights, Benefit)
  - Acceptance clause
- **Replace Article 1 table** with "Schedule of Loan Details and Terms" matching DOCX format:
  - Loan ID, Agreement Date, Borrower, Lender, Principal, Tenure (Days), Rate (1% Per Day), Processing Fee, GST, Amount to be Disbursed, Due Date, Repayment Amount
- Add new props: `totalRepayment`, `netDisbursal`, `tenureDays`, `totalInterest`, `dueDate`
- Remove monthly EMI references (`emi`, `firstEmiDate`)
- Remove Article 3's monthly installment language; replace with single bullet repayment clause

#### 3. `src/components/LOS/Sanction/templates/DailyRepaymentScheduleDocument.tsx`

- **Replace `generateDailySchedule` function** with accrual model:
  - Each day shows: dailyInterest (fixed), interestAccrued (cumulative), totalDue (principal + accrued interest)
- **Update `DailyScheduleItem` interface**: remove `dailyEMI`, `cumulativePaid`, `remainingBalance`; add `dailyInterest`, `interestAccrued`, `totalDue`
- **Update table columns**: Day | Date | Daily Interest | Interest Accrued | Total Amount Due
- **Update Loan Summary section**: remove "Daily EMI Amount" row
- **Update Important Information**: remove "daily EMI payment" language; replace with accrual/bullet repayment language
- **Update summary row**: show total interest and final total due on last day

#### 4. `src/components/LOS/Sanction/templates/KeyFactStatementDocument.tsx` (NEW FILE)

- Create KFS document template matching DOCX pages 9-12:
  - **Annex A - Part 1**: Interest rate and fees/charges table (loan amount, tenure, instalment details, interest rate type, processing fee, APR, penal/contingent charges, foreclosure)
  - **Annex A - Part 2**: Qualitative information (recovery agents, grievance redressal, nodal officer, securitization disclosure, LSP details, cooling-off period)
  - **Annex B**: APR computation table (sanctioned amount, loan term, EPI details, rate, total interest, fees, net disbursed, total to be paid, APR rate, repayment schedule reference)
  - **Annex C**: Repayment Schedule table (Instalment No, Outstanding Principal, Principal, Interest, Instalment)
  - Borrower declaration in English and Hindi
- Props: loan details, borrower info, company details, financial calculations

#### 5. `src/components/LOS/Sanction/templates/CombinedLoanDocuments.tsx`

- Add KFS document as the 4th section (after Daily Repayment Schedule)
- Add page break before KFS
- Update props interface to include new fields needed by updated child templates: `totalRepayment`, `totalInterest`, `netDisbursal`, `dueDate`
- Remove `monthlyEMI` prop (no longer needed)
- Pass `dailyInterestRate` correctly (already 1%, not interestRate/365)

#### 6. `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx`

- Fix `dailyInterestRate` from `interestRate / 365` to `interestRate` (it is already 1% daily)
- Replace `monthlyEMI` prop with `totalRepayment` and `totalInterest`
- Add `netDisbursal` and `dueDate` props
- Update `CombinedLoanDocuments` rendering to pass the corrected values
- Remove `tenure` (months) prop; pass only `tenureDays`

#### 7. `src/components/LOS/Disbursement/DisbursementDashboard.tsx`

- Remove the `calculateEMI` and `generateEMISchedule` functions (monthly reducing balance -- no longer used)
- Remove `monthlyEMI`, `totalMonthlyRepayment`, `totalInterest` (monthly), `firstEmiDate`, `emiSchedule` calculations
- Update CombinedLoanPackCard props to pass correct values: `totalRepayment`, `totalInterest` (daily-based, from eligibility), `netDisbursal`, `dueDate`
- Stop passing `monthlyEMI` and `tenureMonths` to CombinedLoanPackCard

---

### Technical Notes

- All financial values continue to come from `loan_eligibility` table (single source of truth principle preserved)
- Currency formatting uses `Rs.` / `INR` in PDF templates (no rupee symbol due to encoding limitation)
- The KFS is an RBI regulatory requirement -- its inclusion brings the document pack in line with compliance standards
- The accrual-based repayment schedule aligns with the NACH bullet payment (OOFF/ADHO) already configured

