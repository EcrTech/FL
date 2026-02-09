

## Align BLKPAY Excel Export to Bank Template (IDFC FIRST Bank Format)

### Problem
The current export generates columns like `Sr No`, `Loan ID`, `Mobile` which do not match the bank's required template. The bank template has 15 specific columns in a specific order.

### Bank Template Columns (Required)
1. Beneficiary Name (MANDATORY)
2. Beneficiary Account Number (MANDATORY)
3. IFSC (MANDATORY for NEFT/RTGS)
4. Transaction Type - IFT/NEFT/RTGS (MANDATORY)
5. Debit Account Number (MANDATORY - the company's bank account)
6. Transaction Date - DD/MM/YYYY (MANDATORY)
7. Amount (MANDATORY)
8. Currency - INR (MANDATORY)
9. Beneficiary Email ID (OPTIONAL)
10. Remarks (OPTIONAL)
11-15. Custom Header 1-5 (OPTIONAL)

### Current Columns (Wrong)
`Sr No`, `Transaction Type`, `Beneficiary Name`, `Beneficiary Account No`, `IFSC Code`, `Amount`, `Loan ID`, `Email`, `Mobile`, `Remarks`

### Changes

**File: `src/utils/bulkPaymentExport.ts`**

- Update the `BulkPaymentRow` interface to include `debitAccountNumber` field
- Rewrite the row mapping to match the exact bank column order:
  - Remove: `Sr No`, `Loan ID`, `Mobile`
  - Add: `Debit Account Number`, `Transaction Date` (DD/MM/YYYY), `Currency` (INR)
  - Reorder columns to match template exactly
  - Use `Custom Header - 1` for Loan ID (as a reference)
- Update column widths to match new structure
- Row 1 will be headers, row 2 onward will be data (no instruction row -- the bank template's instruction row is just for guidance)

**File: `src/components/LOS/Reports/BulkPaymentReport.tsx`**

- Add a "Debit Account Number" input field in the filters section so the user can enter their company's bank account number before exporting
- Pass the debit account number to the export function
- The preview table columns remain unchanged (they're for internal review, not the bank format)

### Technical Details

Updated export row structure:
```
{
  "Beneficiary Name": beneficiaryName,
  "Beneficiary Account Number": accountNumber,
  "IFSC": ifscCode,
  "Transaction Type": paymentMode (NEFT/RTGS/IFT),
  "Debit Account Number": debitAccountNumber (user input),
  "Transaction Date": format(new Date(), "dd/MM/yyyy"),
  "Amount": amount,
  "Currency": "INR",
  "Beneficiary Email ID": email,
  "Remarks": "LOAN DISB {applicationNumber}",
  "Custom Header - 1": applicationNumber (Loan ID),
  "Custom Header - 2": "",
  "Custom Header - 3": "",
  "Custom Header - 4": "",
  "Custom Header - 5": ""
}
```

No database changes needed. Two files modified.
