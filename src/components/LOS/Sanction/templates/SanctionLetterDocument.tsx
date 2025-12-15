import { format } from "date-fns";
import DocumentHeader from "./DocumentHeader";

interface SanctionLetterDocumentProps {
  companyName: string;
  companyAddress?: string;
  companyCIN?: string;
  logoUrl?: string;
  documentNumber: string;
  documentDate: Date;
  // Borrower Details
  borrowerName: string;
  borrowerAddress: string;
  // Loan Details
  loanAmount: number;
  tenure: number;
  interestRate: number;
  emi: number;
  processingFee: number;
  gstOnProcessingFee: number;
  // Validity
  validUntil: Date;
  // Terms
  termsAndConditions: string[];
  // Signatory
  signatoryName?: string;
  signatoryDesignation?: string;
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

export default function SanctionLetterDocument(props: SanctionLetterDocumentProps) {
  return (
    <div className="bg-background text-foreground p-6 max-w-4xl mx-auto print:p-4 print:text-sm">
      <DocumentHeader
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        logoUrl={props.logoUrl}
        documentTitle="LOAN SANCTION LETTER"
        documentNumber={props.documentNumber}
        documentDate={props.documentDate}
      />

      {/* Recipient */}
      <div className="mb-6">
        <p className="font-medium">To,</p>
        <p className="font-bold text-lg">{props.borrowerName}</p>
        <p className="text-muted-foreground whitespace-pre-line">{props.borrowerAddress}</p>
      </div>

      {/* Subject */}
      <div className="mb-6">
        <p>
          <span className="font-bold">Subject: </span>
          Sanction of Personal Loan – Reference No. {props.documentNumber}
        </p>
      </div>

      {/* Salutation */}
      <div className="mb-6">
        <p>Dear {props.borrowerName.split(' ')[0]},</p>
      </div>

      {/* Body */}
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          We are pleased to inform you that your application for a Personal Loan has been 
          <span className="font-bold text-primary"> APPROVED</span>. 
          Based on our assessment and subject to the terms and conditions mentioned herein, 
          we are sanctioning a loan as per the following details:
        </p>

        {/* Loan Details Table */}
        <div className="my-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Loan Amount Sanctioned</td>
                <td className="p-3">
                  <span className="font-bold text-lg">{formatCurrency(props.loanAmount)}</span>
                  <span className="block text-xs text-muted-foreground">
                    (Rupees {numberToWords(props.loanAmount)} Only)
                  </span>
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Rate of Interest</td>
                <td className="p-3">{props.interestRate}% p.a. (Reducing Balance)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Loan Tenure</td>
                <td className="p-3">{props.tenure} Months</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">EMI Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.emi)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Processing Fee</td>
                <td className="p-3">
                  {formatCurrency(props.processingFee)} + GST ({formatCurrency(props.gstOnProcessingFee)})
                </td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Sanction Validity</td>
                <td className="p-3 font-medium text-destructive">
                  Valid until {format(props.validUntil, "dd MMMM yyyy")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Terms and Conditions */}
        <div className="mb-6">
          <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
            TERMS AND CONDITIONS
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            {props.termsAndConditions.map((term, index) => (
              <li key={index}>{term}</li>
            ))}
          </ol>
        </div>

        {/* Important Notice */}
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-sm text-destructive font-medium">
            ⚠️ This sanction is valid until {format(props.validUntil, "dd MMMM yyyy")}. 
            Post this date, you will need to re-apply for the loan. Please complete the 
            documentation and disbursement formalities before the expiry date.
          </p>
        </div>

        {/* Next Steps */}
        <div className="mt-6">
          <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
            NEXT STEPS
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Accept this sanction letter by signing below</li>
            <li>Complete KYC documentation if not already done</li>
            <li>Set up EMI auto-debit (NACH mandate)</li>
            <li>Provide bank account details for disbursement</li>
            <li>Sign the Loan Agreement and related documents</li>
          </ol>
        </div>

        {/* Closing */}
        <p className="mt-6">
          We thank you for choosing {props.companyName} and look forward to a long-term relationship.
        </p>

        <p>Warm regards,</p>
      </div>

      {/* Signature Section */}
      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <div className="border-t border-foreground pt-2 w-48">
            <p className="text-sm font-medium">For {props.companyName}</p>
            <p className="text-sm">{props.signatoryName || "Authorized Signatory"}</p>
            {props.signatoryDesignation && (
              <p className="text-xs text-muted-foreground">{props.signatoryDesignation}</p>
            )}
          </div>
        </div>
      </div>

      {/* Acceptance Section */}
      <div className="border-t-2 border-primary pt-6 mt-12">
        <h3 className="text-base font-bold mb-4">BORROWER ACCEPTANCE</h3>
        <p className="text-sm text-muted-foreground mb-6">
          I, {props.borrowerName}, hereby accept the above sanction and agree to abide by 
          all the terms and conditions mentioned herein. I confirm that I have read and 
          understood all the terms before signing.
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
