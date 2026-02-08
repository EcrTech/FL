import { format, addDays } from "date-fns";
import DocumentHeader from "./DocumentHeader";

interface DailyScheduleItem {
  dayNumber: number;
  date: Date;
  dailyInterest: number;
  interestAccrued: number;
  totalDue: number;
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

const formatCurrency = (amount: number) => {
  return `Rs.${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

// Generate daily accrual schedule - shows what borrower owes if repaid on each day
const generateDailySchedule = (
  principal: number,
  dailyInterestRate: number,
  tenureDays: number,
  startDate: Date
): DailyScheduleItem[] => {
  const dailyInterest = principal * (dailyInterestRate / 100);
  const schedule: DailyScheduleItem[] = [];

  for (let i = 1; i <= tenureDays; i++) {
    const interestAccrued = dailyInterest * i;
    const totalDue = principal + interestAccrued;

    schedule.push({
      dayNumber: i,
      date: addDays(startDate, i),
      dailyInterest: Math.round(dailyInterest),
      interestAccrued: Math.round(interestAccrued),
      totalDue: Math.round(totalDue),
    });
  }

  return schedule;
};

export default function DailyRepaymentScheduleDocument(props: DailyRepaymentScheduleDocumentProps) {
  const dailyInterest = props.loanAmount * (props.dailyInterestRate / 100);
  const totalInterest = dailyInterest * props.tenureDays;
  const totalRepayment = props.loanAmount + totalInterest;

  const schedule = generateDailySchedule(
    props.loanAmount,
    props.dailyInterestRate,
    props.tenureDays,
    props.disbursementDate
  );

  const maturityDate = addDays(props.disbursementDate, props.tenureDays);

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
          This document shows the total amount payable if the loan is repaid on any given day.
          Interest accrues daily at {props.dailyInterestRate}% of the principal. The full repayment
          is due on {format(maturityDate, "dd MMMM yyyy")}.
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
                <td className="p-3">{props.dailyInterestRate}% per day (Flat)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Daily Interest Amount</td>
                <td className="p-3">{formatCurrency(Math.round(dailyInterest))}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Loan Tenure</td>
                <td className="p-3">{props.tenureDays} Days</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Interest Payable</td>
                <td className="p-3">{formatCurrency(Math.round(totalInterest))}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Amount Repayable</td>
                <td className="p-3 font-bold">{formatCurrency(Math.round(totalRepayment))}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Disbursement Date</td>
                <td className="p-3">{format(props.disbursementDate, "dd MMMM yyyy")}</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Maturity / Due Date</td>
                <td className="p-3 font-medium">{format(maturityDate, "dd MMMM yyyy")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Payment Details */}
      {(props.bankName || props.accountNumber) && (
        <div className="mb-6">
          <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
            3. REPAYMENT COLLECTION DETAILS
          </h3>
          <div className="bg-muted rounded-lg p-4 text-sm">
            <p className="mb-2">Repayment will be collected from:</p>
            {props.bankName && (
              <p><span className="font-medium">Bank:</span> {props.bankName}</p>
            )}
            {props.accountNumber && (
              <p><span className="font-medium">Account Number:</span> {props.accountNumber}</p>
            )}
          </div>
        </div>
      )}

      {/* Section 4: Daily Accrual Schedule */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          {props.bankName ? "4" : "3"}. DAILY INTEREST ACCRUAL SCHEDULE
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          The table below shows the total amount due if the loan is settled on any given day.
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="p-2 text-left">Day</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-right">Daily Interest</th>
                <th className="p-2 text-right">Interest Accrued</th>
                <th className="p-2 text-right">Total Amount Due</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((item, index) => (
                <tr
                  key={item.dayNumber}
                  className={`${index % 2 === 0 ? "bg-muted/30" : ""} ${
                    item.dayNumber === props.tenureDays ? "font-bold bg-primary/10" : ""
                  }`}
                >
                  <td className="p-2">{item.dayNumber}</td>
                  <td className="p-2">{format(item.date, "dd MMM yyyy")}</td>
                  <td className="p-2 text-right">{formatCurrency(item.dailyInterest)}</td>
                  <td className="p-2 text-right">{formatCurrency(item.interestAccrued)}</td>
                  <td className="p-2 text-right">{formatCurrency(item.totalDue)}</td>
                </tr>
              ))}
              {/* Summary Row */}
              <tr className="bg-primary/10 font-bold border-t-2 border-primary">
                <td colSpan={2} className="p-2">TOTAL ON MATURITY</td>
                <td className="p-2 text-right">{formatCurrency(Math.round(dailyInterest))}/day</td>
                <td className="p-2 text-right">{formatCurrency(Math.round(totalInterest))}</td>
                <td className="p-2 text-right">{formatCurrency(Math.round(totalRepayment))}</td>
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
          <li>Interest accrues daily at {props.dailyInterestRate}% of the principal amount ({formatCurrency(Math.round(dailyInterest))} per day).</li>
          <li>The total repayment of {formatCurrency(Math.round(totalRepayment))} is due on {format(maturityDate, "dd MMMM yyyy")}.</li>
          <li>Early repayment is permitted subject to foreclosure charges as per the loan agreement.</li>
          <li>Late payment beyond the due date will attract penal interest and may affect your credit score.</li>
          <li>Ensure sufficient balance in your linked bank account for auto-debit on the due date.</li>
          <li>Keep this schedule for your records and future reference.</li>
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
          I hereby acknowledge that I have received and understood the daily interest accrual schedule. 
          I agree to repay the total amount due on the maturity date as per the schedule mentioned above.
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
