import { format } from "date-fns";
import DocumentHeader from "./DocumentHeader";

interface LoanAgreementDocumentProps {
  companyName: string;
  companyAddress?: string;
  companyCIN?: string;
  companyPhone?: string;
  logoUrl?: string;
  documentNumber: string;
  documentDate: Date;
  jurisdiction?: string;
  // Borrower Details
  borrowerName: string;
  borrowerAddress: string;
  borrowerPhone: string;
  borrowerPAN?: string;
  borrowerAadhaar?: string;
  // Loan Details
  loanAmount: number;
  tenure: number;
  interestRate: number;
  emi: number;
  firstEmiDate?: Date;
  processingFee: number;
  // Charges
  foreclosureRate: number;
  bounceCharges: number;
  penalInterest: number;
  // Bank Details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function LoanAgreementDocument(props: LoanAgreementDocumentProps) {
  return (
    <div className="bg-background text-foreground p-6 max-w-4xl mx-auto print:p-4 print:text-[11px]">
      <DocumentHeader
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        logoUrl={props.logoUrl}
        documentTitle="PERSONAL LOAN AGREEMENT"
        documentNumber={props.documentNumber}
        documentDate={props.documentDate}
      />

      {/* Parties */}
      <div className="mb-6 text-sm">
        <p className="mb-4">
          This Personal Loan Agreement ("Agreement") is executed on{" "}
          <span className="font-bold">{format(props.documentDate, "dd MMMM yyyy")}</span> at{" "}
          <span className="font-bold">{props.jurisdiction || "Mumbai"}</span>
        </p>

        <p className="mb-2 font-bold">BETWEEN:</p>
        
        <div className="bg-muted rounded-lg p-4 mb-4">
          <p className="font-bold">{props.companyName}</p>
          {props.companyCIN && <p className="text-muted-foreground">CIN: {props.companyCIN}</p>}
          <p className="text-muted-foreground">{props.companyAddress}</p>
          <p className="mt-2 text-xs">(Hereinafter referred to as the "Lender")</p>
        </div>

        <p className="mb-2 font-bold text-center">AND</p>

        <div className="bg-muted rounded-lg p-4">
          <p className="font-bold">{props.borrowerName}</p>
          <p className="text-muted-foreground">{props.borrowerAddress}</p>
          <p className="text-muted-foreground">Phone: {props.borrowerPhone}</p>
          {props.borrowerPAN && <p className="text-muted-foreground">PAN: {props.borrowerPAN}</p>}
          <p className="mt-2 text-xs">(Hereinafter referred to as the "Borrower")</p>
        </div>
      </div>

      {/* Recitals */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          RECITALS
        </h3>
        <p className="text-sm text-muted-foreground">
          WHEREAS the Borrower has approached the Lender for availing a personal loan facility 
          and the Lender has agreed to grant such loan to the Borrower subject to the terms and 
          conditions set forth herein.
        </p>
      </div>

      {/* Article 1: Loan Details */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ARTICLE 1: LOAN DETAILS
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Principal Loan Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.loanAmount)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Rate of Interest</td>
                <td className="p-3">{props.interestRate}% per annum (Reducing Balance)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Loan Tenure</td>
                <td className="p-3">{props.tenure} months</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">EMI Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.emi)}</td>
              </tr>
              {props.firstEmiDate && (
                <tr className="border-b border-border">
                  <td className="p-3 bg-muted font-medium">First EMI Date</td>
                  <td className="p-3">{format(props.firstEmiDate, "dd MMMM yyyy")}</td>
                </tr>
              )}
              <tr>
                <td className="p-3 bg-muted font-medium">Processing Fee</td>
                <td className="p-3">{formatCurrency(props.processingFee)} + applicable GST</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Article 2: Disbursement */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ARTICLE 2: DISBURSEMENT
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          The loan amount, after deduction of applicable fees and charges, shall be disbursed 
          to the Borrower's bank account as specified below:
        </p>
        {props.bankName && props.accountNumber && (
          <div className="bg-muted rounded-lg p-4 text-sm">
            <p><span className="font-medium">Bank Name:</span> {props.bankName}</p>
            <p><span className="font-medium">Account Number:</span> {props.accountNumber}</p>
            {props.ifscCode && <p><span className="font-medium">IFSC Code:</span> {props.ifscCode}</p>}
          </div>
        )}
      </div>

      {/* Article 3: Repayment */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ARTICLE 3: REPAYMENT TERMS
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>The Borrower shall repay the loan in {props.tenure} equal monthly installments (EMIs).</li>
          <li>EMI shall be due on the same date of each month as the first EMI date.</li>
          <li>EMI shall be payable through NACH/ECS mandate registered with the Lender.</li>
          <li>The Borrower shall ensure sufficient balance in the account before the EMI due date.</li>
          <li>Any delay in EMI payment shall attract penal interest as mentioned in Article 4.</li>
        </ol>
      </div>

      {/* Article 4: Charges */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ARTICLE 4: OTHER CHARGES
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
                <td className="p-3">{props.penalInterest}% per annum on overdue amount</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Article 5: Representations */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ARTICLE 5: REPRESENTATIONS AND WARRANTIES
        </h3>
        <p className="text-sm text-muted-foreground mb-2">The Borrower represents and warrants that:</p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>All information provided in the loan application is true and complete.</li>
          <li>The Borrower has the legal capacity to enter into this Agreement.</li>
          <li>There are no pending legal proceedings that may affect the Borrower's ability to repay.</li>
          <li>The loan proceeds shall be used for lawful purposes only.</li>
          <li>The Borrower is not insolvent or subject to any bankruptcy proceedings.</li>
        </ol>
      </div>

      {/* Article 6: Events of Default */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ARTICLE 6: EVENTS OF DEFAULT
        </h3>
        <p className="text-sm text-muted-foreground mb-2">The following shall constitute Events of Default:</p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Failure to pay any EMI or other dues within 7 days of the due date.</li>
          <li>Any representation or warranty proving to be false or misleading.</li>
          <li>Death, insolvency, or legal incapacity of the Borrower.</li>
          <li>Breach of any term or condition of this Agreement.</li>
        </ol>
        <p className="text-sm text-muted-foreground mt-4">
          Upon occurrence of an Event of Default, the Lender may declare the entire outstanding 
          amount immediately due and payable, without further notice.
        </p>
      </div>

      {/* Article 7: Governing Law */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ARTICLE 7: GOVERNING LAW AND JURISDICTION
        </h3>
        <p className="text-sm text-muted-foreground">
          This Agreement shall be governed by and construed in accordance with the laws of India. 
          Any disputes arising out of or in connection with this Agreement shall be subject to 
          the exclusive jurisdiction of the courts in <span className="font-medium">{props.jurisdiction || "Mumbai"}</span>.
        </p>
      </div>

      {/* Article 8: Miscellaneous */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          ARTICLE 8: MISCELLANEOUS
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>This Agreement constitutes the entire agreement between the parties.</li>
          <li>No modification shall be valid unless made in writing and signed by both parties.</li>
          <li>The Lender may assign its rights under this Agreement without consent.</li>
          <li>The Borrower shall not assign any rights or obligations under this Agreement.</li>
          <li>Notices shall be sent to the addresses mentioned herein or as updated in writing.</li>
        </ol>
      </div>

      {/* Execution */}
      <div className="border-t-2 border-primary pt-6 mt-8">
        <p className="text-sm text-muted-foreground mb-6">
          IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.
        </p>
        
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold mb-4">FOR THE LENDER:</p>
            <div className="h-16 border-b border-foreground mb-2"></div>
            <p className="text-sm font-medium">{props.companyName}</p>
            <p className="text-xs text-muted-foreground">Authorized Signatory</p>
          </div>
          <div>
            <p className="font-bold mb-4">FOR THE BORROWER:</p>
            <div className="h-16 border-b border-foreground mb-2"></div>
            <p className="text-sm font-medium">{props.borrowerName}</p>
            <p className="text-xs text-muted-foreground">Date: _________________</p>
          </div>
        </div>

        {/* Witness Section */}
        <div className="mt-8 pt-4 border-t border-border">
          <p className="font-bold mb-4">WITNESSES:</p>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Witness 1:</p>
              <div className="h-12 border-b border-foreground mb-2"></div>
              <p className="text-xs">Name: _________________</p>
              <p className="text-xs">Address: _________________</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Witness 2:</p>
              <div className="h-12 border-b border-foreground mb-2"></div>
              <p className="text-xs">Name: _________________</p>
              <p className="text-xs">Address: _________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
