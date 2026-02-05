import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Package, FileText, Download, Printer, Loader2, FileCheck, Eye, Upload } from "lucide-react";
import html2pdf from "html2pdf.js";
import { supabase } from "@/integrations/supabase/client";
import CombinedLoanDocuments from "../Sanction/templates/CombinedLoanDocuments";
import ESignDocumentButton from "../Sanction/ESignDocumentButton";

interface CombinedLoanPackCardProps {
  applicationId: string;
  application: {
    org_id: string;
    application_number?: string;
  };
  sanction: {
    id: string;
    validity_date: string;
  };
  generatedDocs: Array<{
    id: string;
    document_type: string;
    document_number: string;
    customer_signed?: boolean;
    signed_document_path?: string;
  }>;
  applicant: {
    first_name: string;
    last_name?: string;
    mobile?: string;
    email?: string;
    pan_number?: string;
    aadhaar_number?: string;
    current_address?: unknown;
  } | null;
  orgSettings: {
    company_name?: string;
    company_address?: string;
    company_cin?: string;
    company_phone?: string;
    jurisdiction?: string;
    gst_on_processing_fee?: number;
    foreclosure_rate?: number;
    grievance_email?: string;
    grievance_phone?: string;
  } | null;
  bankDetails: {
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
  } | null;
  loanAmount: number;
  tenureMonths: number;
  tenureDays: number;
  interestRate: number;
  monthlyEMI: number;
  processingFee: number;
  gstOnProcessingFee: number;
  firstEmiDate: Date;
  borrowerName: string;
  borrowerAddress: string;
  borrowerPhone: string;
  printRef: (el: HTMLDivElement | null) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onRefetch: () => void;
  conditionsArray: string[] | null;
  defaultTerms: string[];
  onUploadSigned?: () => void;
}

export default function CombinedLoanPackCard({
  applicationId,
  application,
  sanction,
  generatedDocs,
  applicant,
  orgSettings,
  bankDetails,
  loanAmount,
  tenureMonths,
  tenureDays,
  interestRate,
  monthlyEMI,
  processingFee,
  gstOnProcessingFee,
  firstEmiDate,
  borrowerName,
  borrowerAddress,
  borrowerPhone,
  printRef,
  onGenerate,
  isGenerating,
  onRefetch,
  conditionsArray,
  defaultTerms,
  onUploadSigned,
}: CombinedLoanPackCardProps) {
  // Check if all individual documents are generated
  const sanctionDoc = generatedDocs.find(d => d.document_type === "sanction_letter");
  const agreementDoc = generatedDocs.find(d => d.document_type === "loan_agreement");
  const scheduleDoc = generatedDocs.find(d => d.document_type === "daily_schedule");
  const combinedDoc = generatedDocs.find(d => d.document_type === "combined_loan_pack");

  const allIndividualDocsGenerated = sanctionDoc && agreementDoc && scheduleDoc;
  const isCombinedGenerated = !!combinedDoc;
  const isCombinedSigned = combinedDoc?.customer_signed;

  const handleDownloadCombined = () => {
    const printElement = document.getElementById("combined-loan-pack-template");
    if (!printElement) {
      toast.error("Combined document template not available");
      return;
    }

    const opt = {
      margin: 10,
      filename: `Combined-Loan-Pack-${applicationId}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(printElement).save();
  };

  const handlePrintCombined = () => {
    const printElement = document.getElementById("combined-loan-pack-template");
    if (!printElement) {
      toast.error("Combined document template not available");
      return;
    }

    const printContent = printElement.innerHTML;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Combined Loan Pack</title>
            <style>
              @media print {
                body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
                .no-print { display: none; }
                .break-before-page { page-break-before: always; }
              }
              body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleViewSignedDocument = async () => {
    if (combinedDoc?.signed_document_path) {
      const { data } = await supabase.storage
        .from("loan-documents")
        .createSignedUrl(combinedDoc.signed_document_path, 60);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      } else {
        toast.error("Failed to get document URL");
      }
    }
  };

  return (
    <>
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Combined Loan Pack</CardTitle>
                <CardDescription>All loan documents in one file for easy signing</CardDescription>
              </div>
            </div>
            {isCombinedSigned && (
              <Badge className="gap-1 bg-green-500">
                <FileCheck className="h-3 w-3" />
                E-Signed
              </Badge>
            )}
            {isCombinedGenerated && !isCombinedSigned && (
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                Generated
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!allIndividualDocsGenerated && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p>⚠️ Generate all individual documents first (Sanction Letter, Loan Agreement, Daily Repayment Schedule) before creating the combined pack.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {/* Generate Combined Button */}
            <Button
              variant={isCombinedGenerated ? "outline" : "default"}
              onClick={onGenerate}
              disabled={isGenerating || isCombinedGenerated || !allIndividualDocsGenerated}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              {isCombinedGenerated ? "Generated" : "Generate Combined Pack"}
            </Button>

            {/* Download Button */}
            <Button
              variant="outline"
              onClick={handleDownloadCombined}
              disabled={!isCombinedGenerated}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>

            {/* Print Button */}
            <Button
              variant="outline"
              onClick={handlePrintCombined}
              disabled={!isCombinedGenerated}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>

            {/* E-Sign Button */}
            {isCombinedGenerated && !isCombinedSigned && combinedDoc && (
              <ESignDocumentButton
                orgId={application.org_id}
                applicationId={applicationId}
                documentId={combinedDoc.id}
                documentType="combined_loan_pack"
                documentLabel="Combined Loan Pack"
                signerName={borrowerName}
                signerEmail={applicant?.email || ""}
                signerMobile={applicant?.mobile || ""}
                onSuccess={onRefetch}
              />
            )}

            {/* Upload Signed Button */}
            {isCombinedGenerated && !isCombinedSigned && onUploadSigned && (
              <Button
                variant="outline"
                onClick={onUploadSigned}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Signed
              </Button>
            )}

            {/* View Signed Document Button */}
            {isCombinedSigned && combinedDoc?.signed_document_path && (
              <Button
                variant="outline"
                onClick={handleViewSignedDocument}
                className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
              >
                <Eye className="h-4 w-4" />
                View Signed Document
              </Button>
            )}
          </div>

          {/* Document Status Badges */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Includes:</span>
            <Badge variant={sanctionDoc ? "default" : "outline"} className="text-xs">
              {sanctionDoc ? "✓" : "○"} Sanction Letter
            </Badge>
            <Badge variant={agreementDoc ? "default" : "outline"} className="text-xs">
              {agreementDoc ? "✓" : "○"} Loan Agreement
            </Badge>
            <Badge variant={scheduleDoc ? "default" : "outline"} className="text-xs">
              {scheduleDoc ? "✓" : "○"} Daily Schedule
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Hidden Combined Template for PDF Generation */}
      <div className="hidden">
        <div id="combined-loan-pack-template" ref={printRef}>
          <CombinedLoanDocuments
            companyName={orgSettings?.company_name || "Paisaa Saarthi"}
            companyAddress={orgSettings?.company_address}
            companyCIN={orgSettings?.company_cin}
            companyPhone={orgSettings?.company_phone}
            jurisdiction={orgSettings?.jurisdiction}
            sanctionDocNumber={sanctionDoc?.document_number || "SL-DRAFT"}
            agreementDocNumber={agreementDoc?.document_number || "LA-DRAFT"}
            scheduleDocNumber={scheduleDoc?.document_number || "DRS-DRAFT"}
            documentDate={new Date()}
            borrowerName={borrowerName || "N/A"}
            borrowerAddress={borrowerAddress || "N/A"}
            borrowerPhone={borrowerPhone || "N/A"}
            borrowerPAN={applicant?.pan_number}
            borrowerAadhaar={applicant?.aadhaar_number}
            loanAmount={loanAmount}
            tenure={tenureMonths}
            tenureDays={tenureDays}
            interestRate={interestRate}
            monthlyEMI={monthlyEMI}
            dailyInterestRate={interestRate / 365}
            processingFee={processingFee}
            gstOnProcessingFee={gstOnProcessingFee}
            validUntil={new Date(sanction.validity_date)}
            firstEmiDate={firstEmiDate}
            disbursementDate={new Date()}
            bankName={bankDetails?.bank_name}
            accountNumber={bankDetails?.account_number}
            ifscCode={bankDetails?.ifsc_code}
            foreclosureRate={orgSettings?.foreclosure_rate || 4}
            bounceCharges={500}
            penalInterest={24}
            grievanceEmail={orgSettings?.grievance_email}
            grievancePhone={orgSettings?.grievance_phone}
            termsAndConditions={conditionsArray || defaultTerms}
          />
        </div>
      </div>
    </>
  );
}
