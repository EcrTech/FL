import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Download, Printer, Check, Clock, Loader2 } from "lucide-react";
import { format, addDays, addMonths } from "date-fns";
import KFSDocument from "./templates/KFSDocument";
import SanctionLetterDocument from "./templates/SanctionLetterDocument";
import LoanAgreementDocument from "./templates/LoanAgreementDocument";
import DPNDocument from "./templates/DPNDocument";

interface DocumentGeneratorProps {
  applicationId: string;
  sanctionId: string;
  orgId: string;
}

type DocumentType = "kfs" | "sanction_letter" | "loan_agreement" | "dpn";

const documentTypes: { key: DocumentType; label: string; icon: typeof FileText }[] = [
  { key: "kfs", label: "Key Fact Statement", icon: FileText },
  { key: "sanction_letter", label: "Sanction Letter", icon: FileText },
  { key: "loan_agreement", label: "Loan Agreement", icon: FileText },
  { key: "dpn", label: "Demand Promissory Note", icon: FileText },
];

// Calculate EMI
const calculateEMI = (principal: number, rate: number, tenure: number) => {
  const monthlyRate = rate / 12 / 100;
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
    (Math.pow(1 + monthlyRate, tenure) - 1);
  return Math.round(emi);
};

// Generate EMI schedule
const generateEMISchedule = (
  principal: number, 
  rate: number, 
  tenure: number, 
  startDate: Date
) => {
  const monthlyRate = rate / 12 / 100;
  const emi = calculateEMI(principal, rate, tenure);
  let balance = principal;
  const schedule = [];

  for (let i = 1; i <= tenure; i++) {
    const interest = Math.round(balance * monthlyRate);
    const principalPart = emi - interest;
    balance = Math.max(0, balance - principalPart);

    schedule.push({
      emiNumber: i,
      dueDate: addMonths(startDate, i),
      principal: principalPart,
      interest: interest,
      emi: emi,
      balance: Math.round(balance),
    });
  }

  return schedule;
};

export default function DocumentGenerator({ applicationId, sanctionId, orgId }: DocumentGeneratorProps) {
  const [activeTab, setActiveTab] = useState<DocumentType>("kfs");
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch application data
  const { data: application } = useQuery({
    queryKey: ["loan-application-full", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch sanction data
  const { data: sanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  // Fetch primary applicant
  const { data: applicant } = useQuery({
    queryKey: ["primary-applicant", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applicants")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("is_primary", true)
        .maybeSingle();
      return data;
    },
  });

  // Fetch bank details
  const { data: bankDetails } = useQuery({
    queryKey: ["loan-bank-details", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_bank_details")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("is_primary", true)
        .maybeSingle();
      return data;
    },
  });

  // Fetch org settings
  const { data: orgSettings } = useQuery({
    queryKey: ["org-loan-settings", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_loan_settings")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();
      
      // Return defaults if no settings exist
      return data || {
        company_name: "Paisaa Saarthi",
        company_address: "",
        company_cin: "",
        company_phone: "",
        grievance_email: "",
        grievance_phone: "",
        jurisdiction: "Mumbai",
        gst_on_processing_fee: 18,
        foreclosure_rate: 4,
        insurance_charges: 0,
      };
    },
  });

  // Fetch existing generated documents
  const { data: generatedDocs } = useQuery({
    queryKey: ["generated-documents", applicationId, sanctionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_generated_documents")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("sanction_id", sanctionId);
      return data || [];
    },
  });

  // Generate document mutation
  const generateMutation = useMutation({
    mutationFn: async (docType: DocumentType) => {
      const docNumber = `${docType.toUpperCase().replace("_", "")}-${Date.now().toString(36).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from("loan_generated_documents")
        .insert({
          loan_application_id: applicationId,
          sanction_id: sanctionId,
          org_id: orgId,
          document_type: docType,
          document_number: docNumber,
          status: "generated",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-documents", applicationId, sanctionId] });
      toast.success("Document generated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Document</title>
              <style>
                @media print {
                  body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
                  .no-print { display: none; }
                }
                body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
              </style>
              <link rel="stylesheet" href="/src/index.css" />
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const getDocumentStatus = (docType: DocumentType) => {
    const doc = generatedDocs?.find((d) => d.document_type === docType);
    return doc?.status || null;
  };

  const isDocGenerated = (docType: DocumentType) => {
    return generatedDocs?.some((d) => d.document_type === docType);
  };

  if (!application || !sanction || !applicant) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Prepare common data
  const loanAmount = sanction.sanctioned_amount || application.approved_amount || application.loan_amount;
  const interestRate = sanction.interest_rate || application.interest_rate || 12;
  const tenure = sanction.tenure_months || application.tenure_months || 12;
  const processingFee = sanction.processing_fee || 0;
  const gstOnProcessingFee = processingFee * ((orgSettings?.gst_on_processing_fee || 18) / 100);
  const emi = calculateEMI(loanAmount, interestRate, tenure);
  const totalRepayment = emi * tenure;
  const totalInterest = totalRepayment - loanAmount;
  const apr = interestRate; // Simplified, could be calculated more precisely
  const firstEmiDate = addMonths(new Date(), 1);
  const emiSchedule = generateEMISchedule(loanAmount, interestRate, tenure, new Date());

  const borrowerName = `${applicant.first_name} ${applicant.last_name || ""}`.trim();
  const borrowerAddress = [
    applicant.current_address_line1,
    applicant.current_address_line2,
    applicant.current_city,
    applicant.current_state,
    applicant.current_pincode,
  ].filter(Boolean).join(", ");

  const defaultTerms = [
    "The loan is granted subject to satisfactory completion of all documentation.",
    "The borrower must maintain the repayment schedule as agreed.",
    "Any change in contact details must be immediately informed to the lender.",
    "The lender reserves the right to recall the loan in case of default.",
    "All terms and conditions of the loan agreement shall apply.",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Loan Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DocumentType)}>
          <TabsList className="grid grid-cols-4 mb-4">
            {documentTypes.map((doc) => (
              <TabsTrigger key={doc.key} value={doc.key} className="relative">
                <span className="text-xs sm:text-sm">{doc.label}</span>
                {isDocGenerated(doc.key) && (
                  <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            {!isDocGenerated(activeTab) ? (
              <Button
                onClick={() => generateMutation.mutate(activeTab)}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Document
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </>
            )}
          </div>

          {/* Status Badge */}
          {isDocGenerated(activeTab) && (
            <div className="mb-4">
              <Badge variant="outline" className="gap-1">
                <Check className="h-3 w-3" />
                Generated on {format(new Date(), "dd MMM yyyy")}
              </Badge>
            </div>
          )}

          {/* Document Preview */}
          <div ref={printRef} className="border rounded-lg overflow-auto max-h-[600px] bg-white">
            <TabsContent value="kfs" className="m-0">
              <KFSDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                documentNumber={generatedDocs?.find(d => d.document_type === "kfs")?.document_number || "KFS-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName}
                borrowerAddress={borrowerAddress}
                borrowerPhone={applicant.mobile_number || ""}
                borrowerEmail={applicant.email || undefined}
                loanAmount={loanAmount}
                tenure={tenure}
                interestRate={interestRate}
                emi={emi}
                processingFee={processingFee}
                gstOnProcessingFee={gstOnProcessingFee}
                totalInterest={totalInterest}
                totalRepayment={totalRepayment}
                apr={apr}
                emiSchedule={emiSchedule}
                foreclosureRate={orgSettings?.foreclosure_rate || 4}
                bounceCharges={500}
                penalInterest={24}
                grievanceEmail={orgSettings?.grievance_email}
                grievancePhone={orgSettings?.grievance_phone}
              />
            </TabsContent>

            <TabsContent value="sanction_letter" className="m-0">
              <SanctionLetterDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                documentNumber={generatedDocs?.find(d => d.document_type === "sanction_letter")?.document_number || "SL-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName}
                borrowerAddress={borrowerAddress}
                loanAmount={loanAmount}
                tenure={tenure}
                interestRate={interestRate}
                emi={emi}
                processingFee={processingFee}
                gstOnProcessingFee={gstOnProcessingFee}
                validUntil={addDays(new Date(), 30)}
                termsAndConditions={sanction.terms_and_conditions?.split("\n").filter(Boolean) || defaultTerms}
              />
            </TabsContent>

            <TabsContent value="loan_agreement" className="m-0">
              <LoanAgreementDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                companyPhone={orgSettings?.company_phone}
                jurisdiction={orgSettings?.jurisdiction}
                documentNumber={generatedDocs?.find(d => d.document_type === "loan_agreement")?.document_number || "LA-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName}
                borrowerAddress={borrowerAddress}
                borrowerPhone={applicant.mobile_number || ""}
                borrowerPAN={applicant.pan_number}
                borrowerAadhaar={applicant.aadhaar_number}
                loanAmount={loanAmount}
                tenure={tenure}
                interestRate={interestRate}
                emi={emi}
                firstEmiDate={firstEmiDate}
                processingFee={processingFee}
                foreclosureRate={orgSettings?.foreclosure_rate || 4}
                bounceCharges={500}
                penalInterest={24}
                bankName={bankDetails?.bank_name}
                accountNumber={bankDetails?.account_number}
                ifscCode={bankDetails?.ifsc_code}
              />
            </TabsContent>

            <TabsContent value="dpn" className="m-0">
              <DPNDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                jurisdiction={orgSettings?.jurisdiction}
                documentNumber={generatedDocs?.find(d => d.document_type === "dpn")?.document_number || "DPN-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName}
                borrowerAddress={borrowerAddress}
                loanAmount={loanAmount}
                tenure={tenure}
                interestRate={interestRate}
                totalRepayment={totalRepayment}
              />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
