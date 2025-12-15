import { format } from "date-fns";
import DocumentHeader from "./DocumentHeader";

interface DPNDocumentProps {
  companyName: string;
  companyAddress?: string;
  companyCIN?: string;
  logoUrl?: string;
  documentNumber: string;
  documentDate: Date;
  jurisdiction?: string;
  // Borrower Details
  borrowerName: string;
  borrowerAddress: string;
  // Loan Details
  loanAmount: number;
  tenure: number;
  interestRate: number;
  totalRepayment: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
};

export default function DPNDocument(props: DPNDocumentProps) {
  return (
    <div className="bg-background text-foreground p-6 max-w-4xl mx-auto print:p-4 print:text-sm">
      <DocumentHeader
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        logoUrl={props.logoUrl}
        documentTitle="DEMAND PROMISSORY NOTE"
        documentNumber={props.documentNumber}
        documentDate={props.documentDate}
      />

      {/* Stamp Notice */}
      <div className="bg-muted border border-border rounded-lg p-4 mb-6 text-center">
        <p className="text-sm text-muted-foreground">
          [Stamp Paper / e-Stamp of appropriate value as per applicable Stamp Act]
        </p>
      </div>

      {/* Main Content */}
      <div className="border-2 border-primary rounded-lg p-6 mb-6">
        {/* Header Details */}
        <div className="flex justify-between mb-6 text-sm">
          <div>
            <span className="text-muted-foreground">Place:</span>
            <span className="ml-2 font-medium">{props.jurisdiction || "Mumbai"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Date:</span>
            <span className="ml-2 font-medium">{format(props.documentDate, "dd MMMM yyyy")}</span>
          </div>
        </div>

        {/* Amount Box */}
        <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">Principal Amount</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(props.loanAmount)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            (Rupees {numberToWords(props.loanAmount)} Only)
          </p>
        </div>

        {/* Promissory Note Text */}
        <div className="text-sm leading-relaxed space-y-4">
          <p>
            I/We, <span className="font-bold underline">{props.borrowerName}</span>, residing at{" "}
            <span className="font-medium">{props.borrowerAddress}</span>, (hereinafter referred 
            to as "the Maker"),
          </p>

          <p className="font-bold text-center py-2">
            DO HEREBY PROMISE TO PAY
          </p>

          <p>
            to <span className="font-bold">{props.companyName}</span>
            {props.companyCIN && <span className="text-muted-foreground"> (CIN: {props.companyCIN})</span>}, 
            having its registered office at {props.companyAddress || "[Company Address]"} 
            (hereinafter referred to as "the Holder"), or order,
          </p>

          <p className="font-bold text-lg text-center py-4 bg-muted rounded-lg">
            ON DEMAND
          </p>

          <p>
            the sum of <span className="font-bold">{formatCurrency(props.loanAmount)}</span>{" "}
            <span className="text-muted-foreground">(Rupees {numberToWords(props.loanAmount)} Only)</span> 
            together with interest thereon at the rate of{" "}
            <span className="font-bold">{props.interestRate}% per annum</span> (reducing balance) 
            from the date of this Promissory Note until payment, for value received.
          </p>
        </div>

        {/* Terms */}
        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="font-bold mb-3">TERMS:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              This Demand Promissory Note is issued in connection with the Personal Loan 
              Agreement bearing reference number <span className="font-medium">{props.documentNumber}</span>.
            </li>
            <li>
              The loan tenure is <span className="font-medium">{props.tenure} months</span> from 
              the date of disbursement.
            </li>
            <li>
              The Holder is entitled to demand and receive immediate repayment of the 
              entire outstanding amount including principal, interest, and all other charges 
              upon occurrence of any Event of Default as defined in the Loan Agreement.
            </li>
            <li>
              This Promissory Note is non-transferable except with prior written consent of the Maker.
            </li>
            <li>
              Any dispute arising out of this Promissory Note shall be subject to the exclusive 
              jurisdiction of courts in <span className="font-medium">{props.jurisdiction || "Mumbai"}</span>.
            </li>
          </ol>
        </div>
      </div>

      {/* Summary Box */}
      <div className="bg-muted rounded-lg p-4 mb-6">
        <h4 className="font-bold mb-3 text-center">LOAN SUMMARY</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Principal Amount:</span>
            <span className="font-medium">{formatCurrency(props.loanAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interest Rate:</span>
            <span className="font-medium">{props.interestRate}% p.a.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loan Tenure:</span>
            <span className="font-medium">{props.tenure} months</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Repayment:</span>
            <span className="font-bold text-primary">{formatCurrency(props.totalRepayment)}</span>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="border-t-2 border-primary pt-6">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold mb-4">MAKER (Borrower):</p>
            <div className="h-20 border-b border-foreground mb-2"></div>
            <p className="text-sm font-medium">{props.borrowerName}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Address: {props.borrowerAddress}
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Date: _________________
            </p>
          </div>
          <div>
            <p className="font-bold mb-4">ACCEPTED BY (Holder):</p>
            <div className="h-20 border-b border-foreground mb-2"></div>
            <p className="text-sm font-medium">For {props.companyName}</p>
            <p className="text-xs text-muted-foreground">Authorized Signatory</p>
            <p className="text-xs text-muted-foreground mt-4">
              Date: _________________
            </p>
          </div>
        </div>
      </div>

      {/* Revenue Stamp Box */}
      <div className="mt-8 flex justify-end">
        <div className="border-2 border-dashed border-muted-foreground w-32 h-32 flex items-center justify-center text-center">
          <div className="text-xs text-muted-foreground">
            Affix<br />Revenue<br />Stamp<br />Here
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          This Demand Promissory Note is a negotiable instrument under the Negotiable Instruments Act, 1881. 
          Dishonor of this note may attract legal action including prosecution under Section 138 of the Act.
        </p>
      </div>
    </div>
  );
}
