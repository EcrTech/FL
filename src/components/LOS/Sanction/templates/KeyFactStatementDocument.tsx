import { format, addDays } from "date-fns";
import DocumentHeader from "./DocumentHeader";

interface KeyFactStatementDocumentProps {
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
  tenureDays: number;
  interestRate: number;
  totalInterest: number;
  totalRepayment: number;
  processingFee: number;
  gstOnProcessingFee: number;
  netDisbursal: number;
  dueDate: Date;
  disbursementDate: Date;
  // Charges
  foreclosureRate: number;
  bounceCharges: number;
  penalInterest: number;
  // Grievance
  grievanceEmail?: string;
  grievancePhone?: string;
}

const formatCurrency = (amount: number) => {
  return `Rs.${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

export default function KeyFactStatementDocument(props: KeyFactStatementDocumentProps) {
  // Calculate APR (simple approximation for short-term flat-rate loan)
  const totalCost = props.totalInterest + props.processingFee + props.gstOnProcessingFee;
  const apr = ((totalCost / props.netDisbursal) / (props.tenureDays / 365)) * 100;

  return (
    <div className="bg-background text-foreground p-6 max-w-4xl mx-auto print:p-4 print:text-[11px]">
      <DocumentHeader
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        logoUrl={props.logoUrl}
        documentTitle="KEY FACT STATEMENT (KFS)"
        documentNumber={props.documentNumber}
        documentDate={props.documentDate}
      />

      <p className="text-sm text-muted-foreground mb-6">
        As per RBI Circular on Digital Lending dated 02.09.2022, the Key Fact Statement (KFS) 
        is provided to the Borrower prior to execution of the Loan Agreement. This document 
        contains the key facts about the loan in a standardised format.
      </p>

      {/* ANNEX A - Part 1: Interest Rate and Fees */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ANNEX A – PART 1: INTEREST RATE AND FEES/CHARGES
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Loan Sanctioned Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.loanAmount)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Loan Tenure</td>
                <td className="p-3">{props.tenureDays} Days</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Number of Instalments</td>
                <td className="p-3">1 (Bullet Repayment)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Instalment Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.totalRepayment)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Rate of Interest</td>
                <td className="p-3">{props.interestRate}% Per Day (Flat)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Interest Rate Type</td>
                <td className="p-3">Fixed</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Interest Charged</td>
                <td className="p-3">{formatCurrency(props.totalInterest)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Processing Fee</td>
                <td className="p-3">{formatCurrency(props.processingFee)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">GST on Processing Fee</td>
                <td className="p-3">{formatCurrency(props.gstOnProcessingFee)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Net Disbursed Amount</td>
                <td className="p-3 font-bold text-primary">{formatCurrency(props.netDisbursal)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Annual Percentage Rate (APR)</td>
                <td className="p-3 font-bold">{apr.toFixed(2)}%</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Penal/Contingent Charges</td>
                <td className="p-3">Penal Interest @ {props.penalInterest}% p.a. on overdue amount; Bounce Charges {formatCurrency(props.bounceCharges)} per instance + GST</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Foreclosure/Prepayment Charges</td>
                <td className="p-3">{props.foreclosureRate}% of outstanding principal + applicable GST</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ANNEX A - Part 2: Qualitative Information */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ANNEX A – PART 2: QUALITATIVE INFORMATION
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Recovery Agents Engaged</td>
                <td className="p-3">As per RBI guidelines, recovery agents (if engaged) will carry proper authorization and follow the Fair Practices Code.</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Grievance Redressal Officer</td>
                <td className="p-3">
                  {props.grievanceEmail && <span>Email: {props.grievanceEmail}</span>}
                  {props.grievanceEmail && props.grievancePhone && <br />}
                  {props.grievancePhone && <span>Phone: {props.grievancePhone}</span>}
                  {!props.grievanceEmail && !props.grievancePhone && <span>As per company website</span>}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Nodal Officer / Escalation</td>
                <td className="p-3">If the complaint is not resolved within 30 days, the Borrower may escalate to the RBI's Integrated Ombudsman Scheme (https://cms.rbi.org.in).</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Securitisation / Assignment</td>
                <td className="p-3">The Lender reserves the right to securitize or assign the loan. The Borrower will be duly notified in such an event.</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Lending Service Provider (LSP)</td>
                <td className="p-3">Loan facilitated through the Lender's digital lending platform.</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Cooling-Off / Look-Up Period</td>
                <td className="p-3">The Borrower may exit the loan within 3 days of disbursement by repaying the principal and proportionate interest, without any penalty.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ANNEX B: APR Computation */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ANNEX B: APR COMPUTATION
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Sanctioned Loan Amount</td>
                <td className="p-3">{formatCurrency(props.loanAmount)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Loan Term</td>
                <td className="p-3">{props.tenureDays} Days</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Instalment Details</td>
                <td className="p-3">1 Bullet Payment of {formatCurrency(props.totalRepayment)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Rate of Interest</td>
                <td className="p-3">{props.interestRate}% Per Day (Flat, Fixed)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Interest Charged</td>
                <td className="p-3">{formatCurrency(props.totalInterest)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Processing Fee + GST</td>
                <td className="p-3">{formatCurrency(props.processingFee + props.gstOnProcessingFee)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Net Amount Disbursed</td>
                <td className="p-3">{formatCurrency(props.netDisbursal)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Amount to be Paid</td>
                <td className="p-3 font-bold">{formatCurrency(props.totalRepayment)}</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Annual Percentage Rate (APR)</td>
                <td className="p-3 font-bold">{apr.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ANNEX C: Repayment Schedule */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ANNEX C: REPAYMENT SCHEDULE
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="p-2 text-left">Instalment No.</th>
                <th className="p-2 text-left">Due Date</th>
                <th className="p-2 text-right">Outstanding Principal</th>
                <th className="p-2 text-right">Principal</th>
                <th className="p-2 text-right">Interest</th>
                <th className="p-2 text-right">Instalment Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold bg-muted/30">
                <td className="p-2">1</td>
                <td className="p-2">{format(props.dueDate, "dd MMM yyyy")}</td>
                <td className="p-2 text-right">{formatCurrency(props.loanAmount)}</td>
                <td className="p-2 text-right">{formatCurrency(props.loanAmount)}</td>
                <td className="p-2 text-right">{formatCurrency(props.totalInterest)}</td>
                <td className="p-2 text-right">{formatCurrency(props.totalRepayment)}</td>
              </tr>
              <tr className="bg-primary/10 font-bold border-t border-primary">
                <td colSpan={3} className="p-2">TOTAL</td>
                <td className="p-2 text-right">{formatCurrency(props.loanAmount)}</td>
                <td className="p-2 text-right">{formatCurrency(props.totalInterest)}</td>
                <td className="p-2 text-right">{formatCurrency(props.totalRepayment)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Borrower Declaration */}
      <div className="border-t-2 border-primary pt-6 mt-8">
        <h3 className="text-base font-bold mb-4">BORROWER DECLARATION</h3>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            I, {props.borrowerName}, hereby acknowledge that I have received and understood the
            Key Fact Statement. I confirm that the Annual Percentage Rate (APR), recovery mechanism,
            and grievance redressal mechanism have been explained to me prior to signing the Loan Agreement.
          </p>
          <p className="italic">
            (Hindi) Main, {props.borrowerName}, yahan pushthi karta/karti hoon ki mujhe Key Fact Statement
            prapt hua hai aur maine ise samajh liya hai. Main pushthi karta/karti hoon ki mujhe
            Varshik Pratishat Dar (APR), vasuli prakriya, aur shikayat nivaran prakriya ko Rin
            Samjhaute par hastakshar karne se pehle samjhaya gaya hai.
          </p>
        </div>
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
