import SanctionLetterDocument from "./SanctionLetterDocument";
import LoanAgreementDocument from "./LoanAgreementDocument";
import DailyRepaymentScheduleDocument from "./DailyRepaymentScheduleDocument";

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
  documentDate: Date;
  
  // Borrower Details
  borrowerName: string;
  borrowerAddress: string;
  borrowerPhone: string;
  borrowerPAN?: string;
  borrowerAadhaar?: string;
  
  // Loan Details
  loanAmount: number;
  tenure: number; // in months
  tenureDays: number;
  interestRate: number;
  monthlyEMI: number;
  dailyInterestRate: number;
  processingFee: number;
  gstOnProcessingFee: number;
  
  // Dates
  validUntil: Date;
  firstEmiDate: Date;
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
        tenure={props.tenure}
        interestRate={props.interestRate}
        emi={props.monthlyEMI}
        processingFee={props.processingFee}
        gstOnProcessingFee={props.gstOnProcessingFee}
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
        tenure={props.tenure}
        interestRate={props.interestRate}
        emi={props.monthlyEMI}
        firstEmiDate={props.firstEmiDate}
        processingFee={props.processingFee}
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
    </div>
  );
}
