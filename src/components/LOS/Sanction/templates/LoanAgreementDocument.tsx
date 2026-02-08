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
  tenureDays: number;
  interestRate: number;
  totalInterest: number;
  totalRepayment: number;
  processingFee: number;
  gstOnProcessingFee: number;
  netDisbursal: number;
  dueDate: Date;
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
  return `Rs.${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
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

      {/* Schedule of Loan Details */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          SCHEDULE OF LOAN DETAILS AND TERMS
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Loan ID</td>
                <td className="p-3 font-bold">{props.documentNumber}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Agreement Date</td>
                <td className="p-3">{format(props.documentDate, "dd MMMM yyyy")}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Borrower</td>
                <td className="p-3">{props.borrowerName}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Lender</td>
                <td className="p-3">{props.companyName}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Principal Loan Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.loanAmount)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Loan Tenure</td>
                <td className="p-3">{props.tenureDays} Days</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Rate of Interest</td>
                <td className="p-3">{props.interestRate}% Per Day (Flat)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Total Interest</td>
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
                <td className="p-3 bg-muted font-medium">Amount to be Disbursed</td>
                <td className="p-3 font-bold text-primary">{formatCurrency(props.netDisbursal)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Due Date</td>
                <td className="p-3 font-medium">{format(props.dueDate, "dd MMMM yyyy")}</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Repayment Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.totalRepayment)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Witnesseth */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          WITNESSETH
        </h3>
        <div className="text-sm text-muted-foreground space-y-3">
          <p>
            WHEREAS the Borrower has approached the Lender through the digital lending platform
            for availing a personal loan facility and the Lender, being a registered Non-Banking
            Financial Company (NBFC), has agreed to grant such loan to the Borrower subject to the
            terms and conditions set forth herein.
          </p>
          <p>
            NOW THEREFORE, in consideration of the mutual covenants and agreements herein contained
            and for other good and valuable consideration, the receipt and sufficiency of which are
            hereby acknowledged, the parties agree as follows:
          </p>
        </div>
      </div>

      {/* Borrower Acknowledgements */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          1. BORROWER ACKNOWLEDGEMENTS AND CONFIRMATION
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>The Borrower acknowledges that they have voluntarily applied for the loan and have read and understood all the terms and conditions of this Agreement.</li>
          <li>The Borrower confirms that all information provided in the loan application, including personal details, employment details, and financial information, is true, correct, and complete.</li>
          <li>The Borrower acknowledges having received the Key Fact Statement (KFS) containing the details of Annual Percentage Rate (APR), recovery mechanism, and grievance redressal mechanism prior to execution of this Agreement.</li>
          <li>The Borrower confirms that the loan amount shall be used for lawful personal purposes only and not for any speculative or illegal activity.</li>
        </ol>
      </div>

      {/* Borrower Undertaking */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          2. BORROWER UNDERTAKING
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>The Borrower hereby authorizes the Lender to debit the repayment amount from the Borrower's bank account through NACH/eMandate on the due date.</li>
          <li>The Borrower consents to the Lender accessing their credit information from any credit bureau for the purpose of evaluating the loan application and monitoring the loan account.</li>
          <li>The Borrower agrees that all communications, including loan agreements, statements, notices, and reminders may be sent electronically via email, SMS, WhatsApp, or through the digital platform.</li>
          <li>The Borrower undertakes to immediately inform the Lender of any change in their contact details, employment status, or financial condition that may affect their ability to repay.</li>
        </ol>
      </div>

      {/* Representations and Warranties */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          3. REPRESENTATIONS AND WARRANTIES
        </h3>
        <p className="text-sm text-muted-foreground mb-2">The Borrower represents and warrants that:</p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>The Borrower is a citizen and resident of India, is of legal age and has the legal capacity to enter into this Agreement.</li>
          <li>All information provided in the loan application is true, accurate, and complete in all respects.</li>
          <li>There are no pending legal proceedings, suits, or claims against the Borrower that may adversely affect their ability to fulfil their obligations under this Agreement.</li>
          <li>The Borrower is not insolvent and no bankruptcy, insolvency, or winding-up proceedings have been initiated or are contemplated.</li>
          <li>The execution and performance of this Agreement does not violate any law, regulation, or any other agreement to which the Borrower is a party.</li>
        </ol>
      </div>

      {/* Disbursement */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          4. DISBURSEMENT OF THE LOAN
        </h3>
        <div className="text-sm text-muted-foreground space-y-3">
          <p>
            The Lender shall disburse the loan amount of {formatCurrency(props.netDisbursal)} (after deduction
            of processing fee of {formatCurrency(props.processingFee)} and GST of {formatCurrency(props.gstOnProcessingFee)})
            to the Borrower's designated bank account upon completion of all documentation and verification formalities.
          </p>
          {props.bankName && props.accountNumber && (
            <div className="bg-muted rounded-lg p-4">
              <p><span className="font-medium">Bank Name:</span> {props.bankName}</p>
              <p><span className="font-medium">Account Number:</span> {props.accountNumber}</p>
              {props.ifscCode && <p><span className="font-medium">IFSC Code:</span> {props.ifscCode}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Repayment */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          5. REPAYMENT OF THE LOAN
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>
            The Borrower shall repay the entire loan amount of {formatCurrency(props.totalRepayment)} (Principal
            of {formatCurrency(props.loanAmount)} plus Interest of {formatCurrency(props.totalInterest)}) in a
            single bullet payment on or before the due date of {format(props.dueDate, "dd MMMM yyyy")}.
          </li>
          <li>Interest shall accrue at the rate of {props.interestRate}% per day on a flat basis on the principal amount from the date of disbursement.</li>
          <li>The repayment shall be collected through the NACH/eMandate registered by the Borrower with the Lender.</li>
          <li>The Borrower shall ensure sufficient balance in the designated bank account on the due date for successful collection of the repayment amount.</li>
          <li>Any delay in repayment beyond the due date shall attract penal charges as mentioned in this Agreement.</li>
        </ol>
      </div>

      {/* Other Charges */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          6. OTHER CHARGES
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium w-1/2">Foreclosure/Prepayment Charges</td>
                <td className="p-3">{props.foreclosureRate}% of outstanding principal + applicable GST</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 bg-muted font-medium">Bounce/Return Charges</td>
                <td className="p-3">{formatCurrency(props.bounceCharges)} per instance + applicable GST</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">Penal Interest on Default</td>
                <td className="p-3">{props.penalInterest}% per annum on overdue amount</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Events of Default */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          7. EVENTS OF DEFAULT
        </h3>
        <p className="text-sm text-muted-foreground mb-2">The following shall constitute Events of Default:</p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Failure to repay the loan amount on the due date or within any extended period, if granted.</li>
          <li>Any representation, warranty, or statement made by the Borrower proving to be false, incorrect, or misleading in any material respect.</li>
          <li>Death, insolvency, bankruptcy, or legal incapacity of the Borrower.</li>
          <li>Breach of any term, condition, covenant, or obligation under this Agreement.</li>
          <li>The Borrower becoming subject to any criminal proceedings or investigations that may affect their ability to repay.</li>
        </ol>
      </div>

      {/* Consequence of Default */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          8. CONSEQUENCE OF DEFAULT
        </h3>
        <p className="text-sm text-muted-foreground">
          Upon occurrence of an Event of Default, the Lender shall be entitled to: (a) declare
          the entire outstanding amount immediately due and payable without further notice;
          (b) charge penal interest at the rate specified in this Agreement; (c) report the
          default to credit bureaus; and (d) initiate recovery proceedings as per applicable laws
          and RBI guidelines.
        </p>
      </div>

      {/* Notices */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          9. NOTICES
        </h3>
        <p className="text-sm text-muted-foreground">
          All notices, demands, and communications required or permitted under this Agreement
          shall be in writing and shall be deemed duly given when delivered personally, sent
          by registered post, courier, email, or any electronic means to the addresses mentioned
          herein or as updated in writing by either party.
        </p>
      </div>

      {/* Severability */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          10. SEVERABILITY
        </h3>
        <p className="text-sm text-muted-foreground">
          If any provision of this Agreement is found to be invalid, illegal, or unenforceable
          by any court of competent jurisdiction, such invalidity shall not affect the remaining
          provisions of this Agreement, which shall continue in full force and effect.
        </p>
      </div>

      {/* Governing Law */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          11. GOVERNING LAW AND JURISDICTION
        </h3>
        <p className="text-sm text-muted-foreground">
          This Agreement shall be governed by and construed in accordance with the laws of India,
          including the Reserve Bank of India (RBI) regulations applicable to NBFCs and digital
          lending. Any disputes arising out of or in connection with this Agreement shall be
          subject to the exclusive jurisdiction of the courts in{" "}
          <span className="font-medium">{props.jurisdiction || "Mumbai"}</span>.
        </p>
      </div>

      {/* Binding Effect */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          12. BINDING EFFECT AND ENTIRE AGREEMENT
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>This Agreement shall be binding upon and inure to the benefit of the parties and their respective heirs, executors, administrators, successors, and permitted assigns.</li>
          <li>This Agreement, together with the Key Fact Statement and the Sanction Letter, constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, and agreements.</li>
          <li>No modification, amendment, or waiver of any provision of this Agreement shall be valid unless made in writing and signed by both parties.</li>
        </ol>
      </div>

      {/* Miscellaneous */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          13. MISCELLANEOUS
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li><span className="font-medium">Language:</span> This Agreement has been drafted in English and the English version shall prevail in case of any conflict with translations.</li>
          <li><span className="font-medium">Cumulative Rights:</span> The rights and remedies of the Lender under this Agreement are cumulative and not exclusive of any rights or remedies available under law.</li>
          <li><span className="font-medium">Assignment:</span> The Lender may assign, transfer, or securitize its rights under this Agreement without the consent of the Borrower. The Borrower shall not assign any rights or obligations under this Agreement.</li>
          <li><span className="font-medium">Benefit:</span> The Borrower agrees that the terms of this Agreement have been individually negotiated and are fair and reasonable.</li>
        </ol>
      </div>

      {/* Acceptance */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          14. ACCEPTANCE
        </h3>
        <p className="text-sm text-muted-foreground">
          The Borrower hereby confirms having read, understood, and agreed to all the terms and
          conditions of this Agreement. The Borrower acknowledges that signing this Agreement
          (including through electronic/digital means) shall constitute their unconditional
          acceptance and shall be legally binding.
        </p>
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
