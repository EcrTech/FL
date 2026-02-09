import * as XLSX from "xlsx";
import { format } from "date-fns";

export interface BulkPaymentRow {
  applicationNumber: string;
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
  amount: number;
  paymentMode: string;
  email: string;
  mobile: string;
}

export function generateBulkPaymentExcel(data: BulkPaymentRow[], debitAccountNumber: string = "") {
  const txnDate = format(new Date(), "dd/MM/yyyy");

  const rows = data.map((row) => ({
    "Beneficiary Name": row.beneficiaryName || "",
    "Beneficiary Account Number": row.accountNumber || "",
    "IFSC": row.ifscCode || "",
    "Transaction Type": (row.paymentMode || "NEFT").toUpperCase(),
    "Debit Account Number": debitAccountNumber,
    "Transaction Date": txnDate,
    "Amount": row.amount || 0,
    "Currency": "INR",
    "Beneficiary Email ID": row.email || "",
    "Remarks": `LOAN DISB ${row.applicationNumber}`,
    "Custom Header - 1": row.applicationNumber || "",
    "Custom Header - 2": "",
    "Custom Header - 3": "",
    "Custom Header - 4": "",
    "Custom Header - 5": "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 30 },  // Beneficiary Name
    { wch: 22 },  // Beneficiary Account Number
    { wch: 14 },  // IFSC
    { wch: 18 },  // Transaction Type
    { wch: 22 },  // Debit Account Number
    { wch: 14 },  // Transaction Date
    { wch: 14 },  // Amount
    { wch: 8 },   // Currency
    { wch: 25 },  // Beneficiary Email ID
    { wch: 30 },  // Remarks
    { wch: 18 },  // Custom Header - 1
    { wch: 16 },  // Custom Header - 2
    { wch: 16 },  // Custom Header - 3
    { wch: 16 },  // Custom Header - 4
    { wch: 16 },  // Custom Header - 5
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BLKPAY");

  const filename = `BLKPAY_${format(new Date(), "yyyyMMdd")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
