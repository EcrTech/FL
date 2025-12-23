import { format, addDays } from "date-fns";
import DocumentHeader from "./DocumentHeader";
import { calculateLoanDetails, formatCurrency } from "@/utils/loanCalculations";

interface DailyScheduleItem {
  dayNumber: number;
  dueDate: Date;
  dailyEMI: number;
  cumulativePaid: number;
  remainingBalance: number;
}

interface DailyRepaymentScheduleDocumentProps {
  companyName: string;
  companyAddress?: string;
  companyCIN?: string;
  logoUrl?: string;
  documentNumber: string;
  documentDate: Date;
  // Borrower Details
  borrowerName: string;
  borrowerAddress: string;
  borrowerPhone: string;
  // Loan Details
  loanAmount: number;
  dailyInterestRate: number;
  tenureDays: number;
  disbursementDate: Date;
  // Bank Details
  bankName?: string;
  accountNumber?: string;
  // Grievance
  grievanceEmail?: string;
  grievancePhone?: string;
}

// Generate daily repayment schedule
const generateDailySchedule = (
  principal: number,
  dailyInterestRate: number,
  tenureDays: number,
  startDate: Date
): DailyScheduleItem[] => {
  const { totalRepayment, dailyEMI } = calculateLoanDetails(principal, dailyInterestRate, tenureDays);
  
  const schedule: DailyScheduleItem[] = [];
  let remainingBalance = totalRepayment;

  for (let i = 1; i <= tenureDays; i++) {
    const cumulativePaid = dailyEMI * i;
    remainingBalance = Math.max(0, totalRepayment - cumulativePaid);

    schedule.push({
      dayNumber: i,
      dueDate: addDays(startDate, i),
      dailyEMI: dailyEMI,
      cumulativePaid: Math.round(cumulativePaid),
      remainingBalance: Math.round(remainingBalance),
    });
  }

  return schedule;
};

export default function DailyRepaymentScheduleDocument(props: DailyRepaymentScheduleDocumentProps) {
  const { totalInterest, totalRepayment, dailyEMI } = calculateLoanDetails(
    props.loanAmount,
    props.dailyInterestRate,
    props.tenureDays
  );

  const schedule = generateDailySchedule(
    props.loanAmount,
    props.dailyInterestRate,
    props.tenureDays,
    props.disbursementDate
  );

  const firstPaymentDate = addDays(props.disbursementDate, 1);
  const lastPaymentDate = addDays(props.disbursementDate, props.tenureDays);

  return (
    <div className="bg-background text-foreground p-6 max-w-4xl mx-auto print:p-4 print:text-sm">
      <DocumentHeader
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        logoUrl={props.logoUrl}
        documentTitle="DAILY REPAYMENT SCHEDULE"
        documentNumber={props.documentNumber}
        documentDate={props.documentDate}
      />

      {/* Important Notice */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-primary font-medium">
          ℹ️ This document contains your daily repayment schedule. Please ensure timely payment 
          of the daily EMI to avoid late fees and maintain a healthy credit score.
        </p>
      </div>

      {/* Section 1: Borrower Information */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          1. BORROWER INFORMATION
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Borrower Name:</span>
            <span className="ml-2 font-medium">{props.borrowerName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Phone:</span>
            <span className="ml-2 font-medium">{props.borrowerPhone}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Address:</span>
            <span className="ml-2 font-medium">{props.borrowerAddress}</span>
          </div>
        </div>
      </div>

      {/* Section 2: Loan Summary */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          2. LOAN SUMMARY
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Loan Principal Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.loanAmount)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Daily Interest Rate</td>
                <td className="p-3">{props.dailyInterestRate}% per day</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Loan Tenure</td>
                <td className="p-3">{props.tenureDays} Days</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Daily EMI Amount</td>
                <td className="p-3 font-bold text-primary">{formatCurrency(dailyEMI)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Interest Payable</td>
                <td className="p-3">{formatCurrency(totalInterest)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Amount Repayable</td>
                <td className="p-3 font-bold">{formatCurrency(totalRepayment)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Disbursement Date</td>
                <td className="p-3">{format(props.disbursementDate, "dd MMMM yyyy")}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">First Payment Date</td>
                <td className="p-3">{format(firstPaymentDate, "dd MMMM yyyy")}</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Last Payment Date</td>
                <td className="p-3">{format(lastPaymentDate, "dd MMMM yyyy")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Payment Details */}
      {(props.bankName || props.accountNumber) && (
        <div className="mb-6">
          <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
            3. PAYMENT COLLECTION DETAILS
          </h3>
          <div className="bg-muted rounded-lg p-4 text-sm">
            <p className="mb-2">Daily payments will be collected from:</p>
            {props.bankName && (
              <p><span className="font-medium">Bank:</span> {props.bankName}</p>
            )}
            {props.accountNumber && (
              <p><span className="font-medium">Account Number:</span> {props.accountNumber}</p>
            )}
          </div>
        </div>
      )}

      {/* Section 4: Daily Schedule */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          {props.bankName ? "4" : "3"}. DAILY REPAYMENT SCHEDULE
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="p-2 text-left">Day</th>
                <th className="p-2 text-left">Due Date</th>
                <th className="p-2 text-right">Daily EMI</th>
                <th className="p-2 text-right">Cumulative Paid</th>
                <th className="p-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((item, index) => (
                <tr key={item.dayNumber} className={index % 2 === 0 ? "bg-muted/30" : ""}>
                  <td className="p-2">{item.dayNumber}</td>
                  <td className="p-2">{format(item.dueDate, "dd MMM yyyy")}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(item.dailyEMI)}</td>
                  <td className="p-2 text-right">{formatCurrency(item.cumulativePaid)}</td>
                  <td className="p-2 text-right">{formatCurrency(item.remainingBalance)}</td>
                </tr>
              ))}
              {/* Summary Row */}
              <tr className="bg-primary/10 font-bold">
                <td colSpan={2} className="p-2">TOTAL</td>
                <td className="p-2 text-right">{formatCurrency(dailyEMI)} × {props.tenureDays}</td>
                <td className="p-2 text-right">{formatCurrency(totalRepayment)}</td>
                <td className="p-2 text-right">{formatCurrency(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 5: Important Information */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          {props.bankName ? "5" : "4"}. IMPORTANT INFORMATION
        </h3>
        <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground">
          <li>Daily EMI payment must be made before 11:59 PM on each due date.</li>
          <li>Late payment will attract additional charges and may affect your credit score.</li>
          <li>Ensure sufficient balance in your linked bank account for auto-debit.</li>
          <li>Keep this schedule for your records and future reference.</li>
          <li>Contact customer support immediately if you face any payment issues.</li>
        </ul>
      </div>

      {/* Section 6: Grievance Redressal */}
      {(props.grievanceEmail || props.grievancePhone) && (
        <div className="mb-6">
          <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
            {props.bankName ? "6" : "5"}. GRIEVANCE REDRESSAL
          </h3>
          <div className="bg-muted rounded-lg p-4 text-sm">
            <p className="mb-2">For any complaints or grievances, please contact:</p>
            {props.grievanceEmail && (
              <p><span className="font-medium">Email:</span> {props.grievanceEmail}</p>
            )}
            {props.grievancePhone && (
              <p><span className="font-medium">Phone:</span> {props.grievancePhone}</p>
            )}
          </div>
        </div>
      )}

      {/* Acknowledgment */}
      <div className="border-t-2 border-primary pt-6 mt-8">
        <h3 className="text-base font-bold mb-4">BORROWER ACKNOWLEDGMENT</h3>
        <p className="text-sm text-muted-foreground mb-6">
          I hereby acknowledge that I have received and understood the daily repayment schedule. 
          I agree to make timely payments as per the schedule mentioned above.
        </p>
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div>
            <div className="border-t border-foreground pt-2 w-48">
              <p className="text-sm font-medium">Borrower Signature</p>
              <p className="text-xs text-muted-foreground">{props.borrowerName}</p>
            </div>
          </div>
          <div>
            <div className="border-t border-foreground pt-2 w-48">
              <p className="text-sm font-medium">Date</p>
              <p className="text-xs text-muted-foreground">{format(props.documentDate, "dd/MM/yyyy")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
