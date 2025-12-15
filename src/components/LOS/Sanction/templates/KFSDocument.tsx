import { format } from "date-fns";
import DocumentHeader from "./DocumentHeader";

interface EMIScheduleItem {
  emiNumber: number;
  dueDate: Date;
  principal: number;
  interest: number;
  emi: number;
  balance: number;
}

interface KFSDocumentProps {
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
  borrowerEmail?: string;
  // Loan Details
  loanAmount: number;
  tenure: number;
  interestRate: number;
  emi: number;
  disbursementDate?: Date;
  firstEmiDate?: Date;
  lastEmiDate?: Date;
  // Fees
  processingFee: number;
  gstOnProcessingFee: number;
  stampDuty?: number;
  insuranceCharges?: number;
  otherCharges?: number;
  // Computed
  totalInterest: number;
  totalRepayment: number;
  apr: number;
  // EMI Schedule
  emiSchedule: EMIScheduleItem[];
  // Charges
  foreclosureRate: number;
  bounceCharges: number;
  penalInterest: number;
  // Grievance
  grievanceEmail?: string;
  grievancePhone?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function KFSDocument(props: KFSDocumentProps) {
  const totalDeductions = props.processingFee + props.gstOnProcessingFee + 
    (props.stampDuty || 0) + (props.insuranceCharges || 0) + (props.otherCharges || 0);
  const netDisbursement = props.loanAmount - totalDeductions;

  return (
    <div className="bg-background text-foreground p-6 max-w-4xl mx-auto print:p-4 print:text-sm">
      <DocumentHeader
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        logoUrl={props.logoUrl}
        documentTitle="KEY FACT STATEMENT (KFS)"
        documentNumber={props.documentNumber}
        documentDate={props.documentDate}
      />

      {/* Important Notice */}
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-destructive font-medium">
          ⚠️ IMPORTANT: This Key Fact Statement is provided to help you understand the key terms 
          of the loan. Please read all terms carefully before signing the loan agreement.
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
          {props.borrowerEmail && (
            <div>
              <span className="text-muted-foreground">Email:</span>
              <span className="ml-2 font-medium">{props.borrowerEmail}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Loan Details */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          2. LOAN DETAILS
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Loan Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.loanAmount)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Rate of Interest (p.a.)</td>
                <td className="p-3">{props.interestRate}% (Reducing Balance)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Tenure</td>
                <td className="p-3">{props.tenure} Months</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">EMI Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.emi)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Interest Payable</td>
                <td className="p-3">{formatCurrency(props.totalInterest)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Amount Payable</td>
                <td className="p-3 font-bold text-primary">{formatCurrency(props.totalRepayment)}</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Annual Percentage Rate (APR)</td>
                <td className="p-3">{props.apr}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Fees and Charges */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          3. FEES AND CHARGES (UPFRONT DEDUCTIONS)
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Processing Fee</td>
                <td className="p-3">{formatCurrency(props.processingFee)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">GST on Processing Fee (18%)</td>
                <td className="p-3">{formatCurrency(props.gstOnProcessingFee)}</td>
              </tr>
              {props.stampDuty !== undefined && props.stampDuty > 0 && (
                <tr className="border-b border-border">
                  <td className="p-3 bg-muted font-medium">Stamp Duty</td>
                  <td className="p-3">{formatCurrency(props.stampDuty)}</td>
                </tr>
              )}
              {props.insuranceCharges !== undefined && props.insuranceCharges > 0 && (
                <tr className="border-b border-border">
                  <td className="p-3 bg-muted font-medium">Insurance Charges</td>
                  <td className="p-3">{formatCurrency(props.insuranceCharges)}</td>
                </tr>
              )}
              <tr className="border-b border-border bg-muted/50">
                <td className="p-3 font-bold">Total Deductions</td>
                <td className="p-3 font-bold">{formatCurrency(totalDeductions)}</td>
              </tr>
              <tr className="bg-primary/5">
                <td className="p-3 font-bold text-primary">Net Disbursement Amount</td>
                <td className="p-3 font-bold text-primary">{formatCurrency(netDisbursement)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Other Charges */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          4. OTHER CHARGES (IF APPLICABLE)
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Foreclosure/Prepayment Charges</td>
                <td className="p-3">{props.foreclosureRate}% of outstanding principal</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Cheque/EMI Bounce Charges</td>
                <td className="p-3">{formatCurrency(props.bounceCharges)} per instance</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Penal Interest on Default</td>
                <td className="p-3">{props.penalInterest}% p.a. on overdue amount</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 5: EMI Schedule (First 12 months or all if less) */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          5. INDICATIVE EMI SCHEDULE
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="p-2 text-left">EMI No.</th>
                <th className="p-2 text-left">Due Date</th>
                <th className="p-2 text-right">Principal</th>
                <th className="p-2 text-right">Interest</th>
                <th className="p-2 text-right">EMI</th>
                <th className="p-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {props.emiSchedule.slice(0, 12).map((item, index) => (
                <tr key={item.emiNumber} className={index % 2 === 0 ? "bg-muted/30" : ""}>
                  <td className="p-2">{item.emiNumber}</td>
                  <td className="p-2">{format(item.dueDate, "dd MMM yyyy")}</td>
                  <td className="p-2 text-right">{formatCurrency(item.principal)}</td>
                  <td className="p-2 text-right">{formatCurrency(item.interest)}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(item.emi)}</td>
                  <td className="p-2 text-right">{formatCurrency(item.balance)}</td>
                </tr>
              ))}
              {props.emiSchedule.length > 12 && (
                <tr className="bg-muted/50">
                  <td colSpan={6} className="p-2 text-center text-muted-foreground italic">
                    ... showing first 12 EMIs of {props.emiSchedule.length} total EMIs
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 6: Important Information */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          6. IMPORTANT INFORMATION
        </h3>
        <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground">
          <li>EMI is payable on the same date every month as the first EMI date.</li>
          <li>Ensure sufficient balance in your bank account before EMI due date.</li>
          <li>Late payment will attract penal interest and may affect your credit score.</li>
          <li>Prepayment can be made after 3 EMIs have been paid, subject to foreclosure charges.</li>
          <li>All amounts mentioned are subject to change in case of loan restructuring.</li>
        </ul>
      </div>

      {/* Section 7: Grievance Redressal */}
      {(props.grievanceEmail || props.grievancePhone) && (
        <div className="mb-6">
          <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
            7. GRIEVANCE REDRESSAL
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
          I hereby acknowledge that I have received, read, and understood the Key Fact Statement. 
          I confirm that the loan terms have been explained to me in a language I understand.
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
