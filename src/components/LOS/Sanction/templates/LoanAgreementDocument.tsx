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
  borrowerEmail?: string;
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
        documentTitle="LOAN AGREEMENT"
        documentNumber={props.documentNumber}
        documentDate={props.documentDate}
      />

      {/* Page 1: Parties */}
      <div className="mb-6 text-sm">
        <p className="mb-4">
          This loan agreement &quot;Agreement&quot; is entered by electronic means on the day mentioned in the Schedule of Loan Details and Terms of the agreement.
        </p>

        <h3 className="text-base font-bold mb-3">BY AND BETWEEN:</h3>
        
        <p className="mb-4">
          SKYRISE CREDIT AND MARKETING LIMITED, a duly registered Non-Banking Financial Company registered with the Reserve Bank of India and incorporated in India under Companies Act 1956 with Corporate Identification Number (CIN): U74899DL1993PLC055475 with Corporate office:- Office No 110, H-161, Sector -63, Noida, UP- 201301 (hereinafter referred to as the &quot;Lender&quot; which expression shall, unless repugnant to or inconsistent with the context, mean and include their successors and permitted assignees of the (FIRST PART).
        </p>

        <p className="mb-4 text-center font-bold">and</p>

        <p className="mb-4">
          {props.borrowerName} an Indian resident with Permanent Account Number (PAN): {props.borrowerPAN || "N/A"} Address: {props.borrowerAddress} email ID:- {props.borrowerEmail || "N/A"} Phone Number: {props.borrowerPhone} (hereinafter referred to as the &quot;Borrower&quot; which expression shall, unless repugnant to or inconsistent with the context, mean and include their successors and permitted assignees of the (SECOND PART).
        </p>

        <p className="mb-4">
          Borrower and Lender shall together be referred to as the &quot;Parties&quot; and severally as the &quot;Party&quot;
        </p>
      </div>

      {/* Witnesseth */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Witnesseth</h3>
        <div className="text-sm space-y-3">
          <p>
            Whereas, loanflow.com is an online loan origination platform of LOANFLOW FINTECH PVT LTD that markets personal loan product to borrowers. The Service Provider has entered into a Service Agreement with the Lender to originate and process loan applications received from various borrowers.
          </p>
          <p>
            Whereas, the Lender is a Non-Banking Financial Company, engaged in the business to provide loans to individual and business customers in India;
          </p>
          <p>
            Whereas the Borrower is an individual, who has registered on the website by creating his/her account, accepting various permission requests presented by the website, and applied for the loan by furnishing the personal and income details and submitting required KYC documents and providing the undertaking as per this agreement to avail the loan;
          </p>
          <p>
            Whereas the case may be the terms between the Borrower and the Lender are materialized by entering into this binding agreement.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold mb-3">
          NOW THEREFORE, IN CONSIDERATION OF THE MUTUAL PROMISES, COVENANTS AND CONDITIONS HEREINAFTER SET FORTH, THE RECEIPT AND SUFFICIENCY OF WHICH IS HEREBY ACKNOWLEDGED, THE PARTIES HERETO AGREE AS FOLLOWS:
        </h3>
      </div>

      {/* Page 2: Commencement */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold mb-3">1. Commencement</h3>
        <p className="text-sm">
          This agreement shall come into effect from the date of this agreement as recorded in the Schedule of Loan Details and Terms appended to this agreement.
        </p>
      </div>

      {/* Borrower Acknowledgements */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Borrower Acknowledgements and Confirmation:</h3>
        <p className="text-sm mb-2">Borrower hereby acknowledges and confirms following;</p>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>I have personally applied for the Loan on the website after confirming acceptance of the terms and conditions of Use and Privacy Policies listed on the App.</li>
          <li>I acknowledge that my Name, details of Permanent Account Number (PAN), Aadhaar Card or of any other Address and Identity proof are obtained by the Service provider and Lender from the materials I have submitted in the website loanflow.com as part of my profile and loan application for review with my consent.</li>
          <li>I understand the terms of the loan (&quot;Loan&quot;) to be provided to me by the Lender are approved as per the internal policies and credit underwriting Process I further acknowledge, understand and agree that Lender has adopted risk-based pricing, which is arrived by taking into account, broad parameters like the customers financial and credit profile and information and data obtained from various permissions granted by me to the App.</li>
          <li>I understand all the terms listed above and hereby make a drawdown request of the Loan from the Lender and instruct the Lender to transfer the Loan amount to my bank account.</li>
        </ol>
      </div>

      {/* Borrower Undertaking */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Borrower Undertaking</h3>
        <div className="text-sm space-y-3">
          <p>
            I represent that the information and details provided by me for the registration and loan application and the documents submitted by me on the App and by other means are true, correct and that I have not withheld any information.
          </p>
          <p>
            I have read and understood the fees and charges applicable to the Loan that I may avail.
          </p>
          <p>
            I confirm that no insolvency proceedings or suits for recovery of outstanding dues have been initiated and/or are pending against me.
          </p>
          <p>
            I hereby authorize Lender to exchange or share information and details relating to this Application Form to its associate companies or any third party, as may be required or deemed fit, for the purpose of processing this loan application and/or related offerings or other products/services that I may apply for from time to time.
          </p>
          <p>
            I hereby consent to and authorize Lender to increase or decrease the credit limit assigned to me basis Lender&apos;s internal credit policy.
          </p>
          <p>
            By submitting this Application Form, I hereby expressly authorize Lender to send me communications regarding various financial products offered by or from Lender, its group companies and/or third parties through telephone calls/SMSs/emails/post etc. including but not limited to promotional communications and confirm that I shall not challenge receipt of such communications as unsolicited communication, defined under TRAI Regulations on Unsolicited Commercial Communications under the Do Not Call Registry.
          </p>
        </div>
      </div>

      {/* Page 3 */}
      <div className="mb-6 break-before-page print:break-before-page">
        <div className="text-sm space-y-3">
          <p>
            That Lender shall have the right to make disclosure of any information relating to me including personal information, details in relation to Loan, defaults, security, etc to the Credit Information Bureau of India (CIBIL) or any other Credit Bureau and/or any other governmental/regulatory/statutory or private agency/entity, RBI, KYC, including publishing the name as part of wilful defaulter&apos;s list from time to time, as also use for KYC information verification, credit risk analysis, or for other related purposes.
          </p>
          <p>
            I agree and accept that Lender may in its sole discretion, by itself or through authorized persons, advocate, agencies, bureau, etc. verify any information given including check credit references and employment.
          </p>
          <p>
            That the funds shall be used for the Purpose specified the SCHEDULE OF LOAN DETAILS AND TERMS will not be used for speculative or antisocial purpose.
          </p>
          <p>
            I have understood and accepted the late payment and other default charges listed in the SCHEDULE OF LOAN DETAILS AND TERMS.
          </p>
          <p>
            I hereby confirm that I contacted Lender for my requirement of personal loan through the website directly and no representative of Lender or the Service Provider has emphasized me directly/indirectly to make this application for the Loan.
          </p>
        </div>
      </div>

      {/* Representations and Warranties */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Representations and Warranties of the Parties</h3>
        <p className="text-sm mb-2">Each party to the agreement makes the following representations and warranties with respect to itself, and confirms that they are, true, correct and valid:</p>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>He has full power and authority to enter into, deliver and perform the terms and provisions of this agreement and, in particular, to exercise its rights, perform the obligations expressed to be assumed by and make the representations and warranties made by him hereunder;</li>
          <li>His obligation under this agreement are legal and valid binding on him and enforceable against him in accordance with the terms hereof.</li>
          <li>The parties to the agreement warrant and represent to have the legal competence and capacity to execute and perform this agreement.</li>
        </ul>
      </div>

      {/* Disbursement */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Disbursement of the Loan</h3>
        <p className="text-sm">
          The Lender will disburse the loan by online means into the bank account of the borrower as specified by the borrower in its loan application filled on the App after the acceptance of this agreement by the Borrower within 2 working days.
        </p>
      </div>

      {/* Repayment */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Repayment of the Loan</h3>
        <div className="text-sm space-y-3">
          <p>
            Borrower will repay the required repayment amount in full as mentioned in the Schedule of Loan Details and Terms, on or before the due date without any failure.
          </p>
          <p>
            Borrower undertakes to maintain sufficient balance in the account of the drawee bank for payment of the eMandate/ ENACH issued by him on the day when the payment becomes due. The loan is not renewable or extendable and is required to be paid in full including accrued interest, processing and other fees as recorded in the Schedule of Loan Details and Terms.
          </p>
        </div>
      </div>

      {/* Page 4: Events of Default */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold mb-3">Events of Defaults</h3>
        <p className="text-sm mb-2">The following events shall constitute &apos;Events of Default&apos;:</p>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>The borrower failing to repay the loan or any fee, charges, or costs in the manner herein contained or any other amount due hereunder remains unpaid after the date on which it is due; or</li>
          <li>In case of death of the borrower or the borrower becomes insolvent or bankrupt; or</li>
          <li>Any of the eMandate/ ENACH / Post Dated Cheques delivered or to be delivered by the borrower to the lender in terms and conditions hereof is not realized for any reason whatsoever on presentation; or</li>
          <li>Any instruction being given by the borrower for stop payment of any eMandate/ ENACH / Post Dated Cheques for any reason whatsoever; or</li>
          <li>On the borrower committing breach of any of the terms, covenants and conditions herein contained or any information given or representations made by the borrower to the lender under this agreement or any other document submitted by the borrower being found to be inaccurate or misleading.</li>
        </ul>
      </div>

      {/* Consequence of Default */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Consequence of default</h3>
        <div className="text-sm space-y-3">
          <p>
            The Service Provider on behalf of the Lender or Lender will take such necessary steps as permitted by law against the borrower to realize the amounts due along with the interest at the decided rate and other fees / costs as agreed in this agreement including appointment of collection agents, appointment of attorneys/ consultants, as it thinks fit.
          </p>
          <p>
            Cost of initiating legal proceedings and collection charges, if any, incurred by lender, to be borne by the borrower.
          </p>
          <p>
            In case eMandate or ENACH is not realized, the Lender reserves the right to initiate proceedings under Section 25 payment settlement act 2007 in addition to the recovery proceedings initiated for nonrepayment.
          </p>
        </div>
      </div>

      {/* Notices */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Notices</h3>
        <p className="text-sm">
          All correspondence shall be addressed to the address as mentioned in the description of parties appearing in the preamble to this agreement and the registered email addresses of the parties.
        </p>
      </div>

      {/* Severability */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Severability</h3>
        <p className="text-sm">
          If any provision of this agreement is found to be invalid or unenforceable, then the invalid or unenforceable provision will be deemed superseded by a valid enforceable provision that most closely matches the intent of the original provision and the remainder of the agreement shall continue in effect.
        </p>
      </div>

      {/* Page 5: Governing Law */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold mb-3">Governing law, Dispute Resolution and Jurisdiction</h3>
        <div className="text-sm space-y-3">
          <p>
            Any dispute, which could not be settled by the parties through amicable settlement (as provided for under above clause) shall be finally settled by the court of law having jurisdiction to grant the same.
          </p>
          <p>
            Jurisdiction – New Delhi, Delhi
          </p>
          <p>
            This agreement and the arrangements contemplated hereby shall in all respects be governed by and construed in accordance with the laws of India without giving effect to the principles of conflict of laws thereunder.
          </p>
        </div>
      </div>

      {/* Binding Effect */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Binding Effect</h3>
        <p className="text-sm">
          All warranties, undertakings and agreements given herein by the parties shall be binding upon the parties and upon its legal representatives and estates. This agreement (together with any amendments or modifications thereof) supersedes all prior discussions and agreements (whether oral or written) between the parties with respect to the transaction.
        </p>
      </div>

      {/* Entire Agreement */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Entire Agreement</h3>
        <p className="text-sm">
          This agreement, along with the terms and conditions and the SCHEDULE OF LOAN DETAILS AND TERMS represents the entire agreement.
        </p>
      </div>

      {/* Miscellaneous */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Miscellaneous</h3>
        <div className="text-sm space-y-3">
          <p><span className="font-bold">Language:</span> English shall be used in all correspondence and communications between the Parties.</p>
          <p><span className="font-bold">Cumulative Rights:</span> All remedies of lender under this agreement whether provided herein or conferred by statute, civil law, common law, custom, trade, or usage are cumulative and not alternative and may be enforced successively or concurrently.</p>
          <p><span className="font-bold">Benefit of the Loan Agreement:</span> The loan agreement shall be binding upon and to ensure to the benefit of each party thereto and its successors or heirs, administrators, as the case may be.</p>
          <p>
            Any delay in exercising or omission to exercise any right, power or remedy accruing to the lender under this agreement or any other agreement or document shall not impair any such right, power or remedy and shall not be construed to be a waiver thereof or any acquiescence in any default; nor shall the action or inaction of the lender in respect of any default or any acquiescence in any default, affect or impair any right, power or remedy of lender in respect of any other default.
          </p>
        </div>
      </div>

      {/* Acceptance */}
      <div className="mb-6" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h3 className="text-base font-bold mb-3">Acceptance</h3>
        <div className="text-sm space-y-2">
          <p>The parties hereby declares as follows:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>They have read the entire agreement and shall be bound by all the conditions.</li>
            <li>The agreement is presented in the form of electronic text in the App and will be executed by clicking on the tabs or prompts presented for the acceptance of the agreement.</li>
          </ul>
          <p>
            They agree that this agreement shall be concluded and become legally binding on the date when it is accepted by the Borrower by means of prompts presented on the App for acceptance.
          </p>
        </div>
      </div>

      {/* IN WHEREOF */}
      <div className="mb-6">
        <p className="text-sm">
          IN WHEREOF the Parties have executed this Agreement as of ({format(props.documentDate, "dd/MM/yyyy")}) by means of adding their acceptance on the website where they have logged in with their valid credentials using their registered phone number and email IDs.
        </p>
      </div>

      {/* Page 6: Schedule of Loan Details */}
      <div className="mb-6 break-before-page print:break-before-page">
        <h3 className="text-base font-bold text-primary border-b border-primary pb-1 mb-3">
          SCHEDULE OF LOAN DETAILS AND TERMS
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="p-3 text-left font-bold w-12">SN</th>
                <th className="p-3 text-left font-bold">ITEM</th>
                <th className="p-3 text-left font-bold">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3">1</td>
                <td className="p-3 font-medium">Loan ID Number</td>
                <td className="p-3 font-bold">{props.documentNumber}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">2</td>
                <td className="p-3 font-medium">Agreement Date</td>
                <td className="p-3">{format(props.documentDate, "do MMM, yyyy")}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">3</td>
                <td className="p-3 font-medium">Borrower</td>
                <td className="p-3">{props.borrowerName}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">4</td>
                <td className="p-3 font-medium">Lender</td>
                <td className="p-3">SKYRISE CREDIT AND MARKETING LIMITED</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">7</td>
                <td className="p-3 font-medium">Principal Loan Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.loanAmount)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">8</td>
                <td className="p-3 font-medium">Tenure (Days/Months)</td>
                <td className="p-3">{props.tenureDays} Days</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">9</td>
                <td className="p-3 font-medium">Rate of Interest</td>
                <td className="p-3">{props.interestRate.toFixed(2)} Per Day</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">10</td>
                <td className="p-3 font-medium">Processing Fees</td>
                <td className="p-3">{formatCurrency(props.processingFee)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">12</td>
                <td className="p-3 font-medium">GST</td>
                <td className="p-3">{formatCurrency(props.gstOnProcessingFee)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">13</td>
                <td className="p-3 font-medium">Amount to be Disbursed</td>
                <td className="p-3 font-bold text-primary">{formatCurrency(props.netDisbursal)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">14</td>
                <td className="p-3 font-medium">Due Date</td>
                <td className="p-3 font-medium">{format(props.dueDate, "do MMMM, yyyy")}</td>
              </tr>
              <tr>
                <td className="p-3">15</td>
                <td className="p-3 font-medium">Repayment Amount</td>
                <td className="p-3 font-bold">{formatCurrency(props.totalRepayment)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature Blocks */}
      <div className="mt-8 text-sm">
        <p className="mb-4">Best regards</p>
        <p className="mb-6">For SKYRISE CREDIT AND MARKETING LIMITED</p>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold mb-2">For SKYRISE CREDIT AND MARKETING LIMITED.</p>
            <div className="h-16 border-b border-foreground mb-2"></div>
            <p className="text-xs">Authorized Signatory</p>
          </div>
          <div>
            <p className="font-bold mb-2">Signature of the Applicant</p>
            <div className="h-16 border-b border-foreground mb-2"></div>
            <p className="text-sm">Name : ______{props.borrowerName}_________________</p>
            <p className="text-xs mt-2">Specimen Signature/ESIGN Impression</p>
          </div>
        </div>
      </div>
    </div>
  );
}
