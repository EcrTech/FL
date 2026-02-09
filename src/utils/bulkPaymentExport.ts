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

export function generateBulkPaymentExcel(data: BulkPaymentRow[]) {
  const rows = data.map((row, index) => ({
    "Sr No": index + 1,
    "Transaction Type": (row.paymentMode || "NEFT").toUpperCase(),
    "Beneficiary Name": row.beneficiaryName || "",
    "Beneficiary Account No": row.accountNumber || "",
    "IFSC Code": row.ifscCode || "",
    "Amount": row.amount || 0,
    "Loan ID": row.applicationNumber || "",
    "Email": row.email || "",
    "Mobile": row.mobile || "",
    "Remarks": `LOAN DISB ${row.applicationNumber}`,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 6 },   // Sr No
    { wch: 18 },  // Transaction Type
    { wch: 30 },  // Beneficiary Name
    { wch: 22 },  // Account No
    { wch: 14 },  // IFSC
    { wch: 14 },  // Amount
    { wch: 18 },  // Loan ID
    { wch: 25 },  // Email
    { wch: 14 },  // Mobile
    { wch: 30 },  // Remarks
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BLKPAY");

  const filename = `BLKPAY_${format(new Date(), "yyyyMMdd")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
