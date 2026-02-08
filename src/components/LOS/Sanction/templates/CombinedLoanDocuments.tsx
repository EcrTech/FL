import SanctionLetterDocument from "./SanctionLetterDocument";
import LoanAgreementDocument from "./LoanAgreementDocument";
import DailyRepaymentScheduleDocument from "./DailyRepaymentScheduleDocument";
import KeyFactStatementDocument from "./KeyFactStatementDocument";

export interface CombinedLoanDocumentsProps {
  // Company Details
  companyName: string;
  companyAddress?: string;
  companyCIN?: string;
  companyPhone?: string;
  jurisdiction?: string;
  logoUrl?: string;
  
  // Document Details
  sanctionDocNumber: string;
  agreementDocNumber: string;
  scheduleDocNumber: string;
  kfsDocNumber: string;
  documentDate: Date;
  
  // Borrower Details
  borrowerName: string;
  borrowerAddress: string;
  borrowerPhone: string;
  borrowerPAN?: string;
  borrowerAadhaar?: string;
  
  // Loan Details
  loanAmount: number;
  tenureDays: number;
  interestRate: number; // daily rate, e.g. 1 for 1%
  dailyInterestRate: number; // same as interestRate (1% daily)
  totalInterest: number;
  totalRepayment: number;
  processingFee: number;
  gstOnProcessingFee: number;
  netDisbursal: number;
  
  // Dates
  validUntil: Date;
  dueDate: Date;
  disbursementDate: Date;
  
  // Bank Details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  
  // Org Settings
  foreclosureRate?: number;
  bounceCharges?: number;
  penalInterest?: number;
  grievanceEmail?: string;
  grievancePhone?: string;
  
  // Terms
  termsAndConditions: string[];
  
  // Signatory
  signatoryName?: string;
  signatoryDesignation?: string;
}

export default function CombinedLoanDocuments(props: CombinedLoanDocumentsProps) {
  return (
    <div className="combined-loan-documents">
      {/* Page 1-2: Sanction Letter */}
      <SanctionLetterDocument
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        logoUrl={props.logoUrl}
        documentNumber={props.sanctionDocNumber}
        documentDate={props.documentDate}
        borrowerName={props.borrowerName}
        borrowerAddress={props.borrowerAddress}
        loanAmount={props.loanAmount}
        tenureDays={props.tenureDays}
        interestRate={props.interestRate}
        totalInterest={props.totalInterest}
        totalRepayment={props.totalRepayment}
        processingFee={props.processingFee}
        gstOnProcessingFee={props.gstOnProcessingFee}
        netDisbursal={props.netDisbursal}
        dueDate={props.dueDate}
        validUntil={props.validUntil}
        termsAndConditions={props.termsAndConditions}
        signatoryName={props.signatoryName}
        signatoryDesignation={props.signatoryDesignation}
      />
      
      {/* Page break for print/PDF */}
      <div className="break-before-page print:break-before-page" style={{ pageBreakBefore: 'always' }} />
      
      {/* Page 3-5: Loan Agreement */}
      <LoanAgreementDocument
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        companyPhone={props.companyPhone}
        jurisdiction={props.jurisdiction}
        documentNumber={props.agreementDocNumber}
        documentDate={props.documentDate}
        borrowerName={props.borrowerName}
        borrowerAddress={props.borrowerAddress}
        borrowerPhone={props.borrowerPhone}
        borrowerPAN={props.borrowerPAN}
        borrowerAadhaar={props.borrowerAadhaar}
        loanAmount={props.loanAmount}
        tenureDays={props.tenureDays}
        interestRate={props.interestRate}
        totalInterest={props.totalInterest}
        totalRepayment={props.totalRepayment}
        processingFee={props.processingFee}
        gstOnProcessingFee={props.gstOnProcessingFee}
        netDisbursal={props.netDisbursal}
        dueDate={props.dueDate}
        foreclosureRate={props.foreclosureRate || 4}
        bounceCharges={props.bounceCharges || 500}
        penalInterest={props.penalInterest || 24}
        bankName={props.bankName}
        accountNumber={props.accountNumber}
        ifscCode={props.ifscCode}
      />
      
      {/* Page break for print/PDF */}
      <div className="break-before-page print:break-before-page" style={{ pageBreakBefore: 'always' }} />
      
      {/* Page 6+: Daily Repayment Schedule */}
      <DailyRepaymentScheduleDocument
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        documentNumber={props.scheduleDocNumber}
        documentDate={props.documentDate}
        borrowerName={props.borrowerName}
        borrowerAddress={props.borrowerAddress}
        borrowerPhone={props.borrowerPhone}
        loanAmount={props.loanAmount}
        dailyInterestRate={props.dailyInterestRate}
        tenureDays={props.tenureDays}
        disbursementDate={props.disbursementDate}
        bankName={props.bankName}
        accountNumber={props.accountNumber}
        grievanceEmail={props.grievanceEmail}
        grievancePhone={props.grievancePhone}
      />

      {/* Page break for print/PDF */}
      <div className="break-before-page print:break-before-page" style={{ pageBreakBefore: 'always' }} />

      {/* Key Fact Statement */}
      <KeyFactStatementDocument
        companyName={props.companyName}
        companyAddress={props.companyAddress}
        companyCIN={props.companyCIN}
        logoUrl={props.logoUrl}
        documentNumber={props.kfsDocNumber}
        documentDate={props.documentDate}
        borrowerName={props.borrowerName}
        borrowerAddress={props.borrowerAddress}
        borrowerPhone={props.borrowerPhone}
        loanAmount={props.loanAmount}
        tenureDays={props.tenureDays}
        interestRate={props.interestRate}
        totalInterest={props.totalInterest}
        totalRepayment={props.totalRepayment}
        processingFee={props.processingFee}
        gstOnProcessingFee={props.gstOnProcessingFee}
        netDisbursal={props.netDisbursal}
        dueDate={props.dueDate}
        disbursementDate={props.disbursementDate}
        foreclosureRate={props.foreclosureRate || 4}
        bounceCharges={props.bounceCharges || 500}
        penalInterest={props.penalInterest || 24}
        grievanceEmail={props.grievanceEmail}
        grievancePhone={props.grievancePhone}
      />
    </div>
  );
}
