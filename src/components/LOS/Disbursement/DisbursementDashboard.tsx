import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  FileText, Download, Printer, Loader2, Send, Check, 
  TrendingUp, Banknote, Calculator, Calendar, Upload, FileCheck
} from "lucide-react";
import { addMonths } from "date-fns";
import html2pdf from "html2pdf.js";

// Document template imports
import SanctionLetterDocument from "../Sanction/templates/SanctionLetterDocument";
import LoanAgreementDocument from "../Sanction/templates/LoanAgreementDocument";
import DailyRepaymentScheduleDocument from "../Sanction/templates/DailyRepaymentScheduleDocument";
import UploadSignedDocumentDialog from "../Sanction/UploadSignedDocumentDialog";

// ESign imports
import { RequestESignButton } from "../ESign/RequestESignButton";
import { ESignStatusBadge } from "../ESign/ESignStatusBadge";
import { useESignRequestByDocument } from "../ESign/useESignRequests";

interface DisbursementDashboardProps {
  applicationId: string;
}

type DocumentType = "sanction_letter" | "loan_agreement" | "daily_schedule";

const documentTypes: { key: DocumentType; label: string; shortLabel: string }[] = [
  { key: "sanction_letter", label: "Sanction Letter", shortLabel: "Sanction" },
  { key: "loan_agreement", label: "Loan Agreement", shortLabel: "Agreement" },
  { key: "daily_schedule", label: "Daily Repayment Schedule", shortLabel: "Repayment" },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const calculateEMI = (principal: number, rate: number, tenure: number) => {
  const monthlyRate = rate / 12 / 100;
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
    (Math.pow(1 + monthlyRate, tenure) - 1);
  return Math.round(emi);
};

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

const formatAddress = (addressJson: unknown): string => {
  if (!addressJson) return "";
  const addr = addressJson as Record<string, string>;
  return [
    addr.line1 || addr.address_line1,
    addr.line2 || addr.address_line2,
    addr.city,
    addr.state,
    addr.pincode || addr.postal_code,
  ].filter(Boolean).join(", ");
};

export default function DisbursementDashboard({ applicationId }: DisbursementDashboardProps) {
  const printRefs = useRef<Record<DocumentType, HTMLDivElement | null>>({
    sanction_letter: null,
    loan_agreement: null,
    daily_schedule: null,
  });
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);

  // Fetch application data
  const { data: application, isLoading: loadingApp } = useQuery({
    queryKey: ["loan-application", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  // Fetch sanction data
  const { data: sanction, isLoading: loadingSanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  // Fetch primary applicant
  interface ApplicantData {
    first_name: string;
    last_name?: string;
    mobile?: string;
    alternate_mobile?: string;
    email?: string;
    current_address?: unknown;
    pan_number?: string;
    aadhaar_number?: string;
  }
  
  const { data: applicant, isLoading: loadingApplicant } = useQuery<ApplicantData | null>({
    queryKey: ["primary-applicant", applicationId],
    queryFn: async () => {
      try {
        const session = await supabase.auth.getSession();
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/loan_applicants?loan_application_id=eq.${applicationId}&applicant_type=eq.primary&select=first_name,last_name,mobile,alternate_mobile,email,current_address,pan_number,aadhaar_number`;
        console.log("Fetching applicant from:", url);
        const result = await fetch(
          url,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${session.data.session?.access_token}`,
            },
          }
        );
        const jsonData = await result.json();
        console.log("Applicant data response:", jsonData);
        return jsonData?.[0] || null;
      } catch (error) {
        console.error("Error fetching applicant:", error);
        return null;
      }
    },
  });

  // Fetch bank details
  const { data: bankDetails } = useQuery({
    queryKey: ["loan-bank-details", applicationId],
    queryFn: async (): Promise<{ bank_name?: string; account_number?: string; ifsc_code?: string } | null> => {
      try {
        const session = await supabase.auth.getSession();
        const result = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/loan_bank_details?loan_application_id=eq.${applicationId}&is_primary=eq.true&select=*`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${session.data.session?.access_token}`,
            },
          }
        );
        const jsonData = await result.json();
        return jsonData?.[0] || null;
      } catch {
        return null;
      }
    },
  });

  // Fetch org settings
  const { data: orgSettings } = useQuery({
    queryKey: ["org-loan-settings", application?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_loan_settings")
        .select("*")
        .eq("org_id", application!.org_id)
        .maybeSingle();
      
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
    enabled: !!application?.org_id,
  });

  // Fetch loan eligibility data (single source of truth for calculated values)
  const { data: eligibility } = useQuery({
    queryKey: ["loan-eligibility", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_eligibility")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch existing generated documents
  const { data: generatedDocs, refetch: refetchDocs } = useQuery({
    queryKey: ["generated-documents", applicationId, sanction?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_generated_documents")
        .select("*")
        .eq("loan_application_id", applicationId);
      
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
          sanction_id: sanction?.id || null,
          org_id: application!.org_id,
          document_type: docType,
          document_number: docNumber,
          status: "generated",
        })
        .select()
        .single();

      if (error) throw error;
      return { data, docType };
    },
    onSuccess: ({ docType }) => {
      queryClient.invalidateQueries({ queryKey: ["generated-documents", applicationId, sanction?.id] });
      toast.success(`${documentTypes.find(d => d.key === docType)?.label} generated successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDownload = (docType: DocumentType) => {
    const printRef = printRefs.current[docType];
    if (!printRef) {
      toast.error("Document template not available. Please ensure applicant and sanction data are loaded.");
      console.error("Print ref not found for:", docType, "applicant:", !!applicant, "sanction:", !!sanction);
      return;
    }
    
    const docLabel = documentTypes.find(d => d.key === docType)?.label || docType;
    const opt = {
      margin: 10,
      filename: `${docLabel.replace(/\s+/g, '-')}-${applicationId}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(printRef).save();
  };

  const handlePrint = (docType: DocumentType) => {
    const printRef = printRefs.current[docType];
    if (printRef) {
      const printContent = printRef.innerHTML;
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
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const isDocGenerated = (docType: DocumentType) => {
    return generatedDocs?.some((d) => d.document_type === docType);
  };

  if (loadingApp || loadingSanction) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!application) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Application not found</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate loan summary values - use stored eligibility values (single source of truth)
  const loanAmount = sanction?.sanctioned_amount || application.approved_amount || eligibility?.eligible_loan_amount || application.requested_amount || 0;
  const interestRate = sanction?.sanctioned_rate || application.interest_rate || eligibility?.recommended_interest_rate || 0;
  const tenureDays = sanction?.sanctioned_tenure_days || application.tenure_days || eligibility?.recommended_tenure_days || 30;
  const tenureMonths = application.tenure_months || Math.round(tenureDays / 30);
  
  // Use stored values from eligibility (single source of truth), with fallback calculation
  const calculatedInterest = loanAmount * (interestRate / 100) * tenureDays;
  const calculatedRepayment = loanAmount + calculatedInterest;
  
  const interestAmount = eligibility?.total_interest ?? Math.round(calculatedInterest * 100) / 100;
  const totalRepayment = eligibility?.total_repayment ?? Math.round(calculatedRepayment * 100) / 100;
  const dailyEMI = eligibility?.daily_emi ?? Math.round(calculatedRepayment / tenureDays);
  
  // For monthly EMI documents
  // Processing fee is 10% of loan amount (standard)
  const processingFeeRate = 10; // 10%
  const processingFee = sanction?.processing_fee || Math.round(loanAmount * (processingFeeRate / 100));
  const gstOnProcessingFee = processingFee * ((orgSettings?.gst_on_processing_fee || 18) / 100);
  const netDisbursal = loanAmount - processingFee;
  const monthlyEMI = calculateEMI(loanAmount, interestRate, tenureMonths);
  const totalMonthlyRepayment = monthlyEMI * tenureMonths;
  const totalInterest = totalMonthlyRepayment - loanAmount;
  const firstEmiDate = addMonths(new Date(), 1);
  const emiSchedule = generateEMISchedule(loanAmount, interestRate, tenureMonths, new Date());

  const borrowerName = applicant ? `${applicant.first_name} ${applicant.last_name || ""}`.trim() : "";
  const borrowerAddress = applicant ? formatAddress(applicant.current_address) : "";
  const borrowerPhone = applicant?.mobile || applicant?.alternate_mobile || "";

  const conditionsText = sanction?.conditions 
    ? (typeof sanction.conditions === 'string' 
        ? sanction.conditions 
        : JSON.stringify(sanction.conditions, null, 2))
    : null;

  const defaultTerms = [
    "The loan is granted subject to satisfactory completion of all documentation.",
    "The borrower must maintain the repayment schedule as agreed.",
    "Any change in contact details must be immediately informed to the lender.",
    "The lender reserves the right to recall the loan in case of default.",
    "All terms and conditions of the loan agreement shall apply.",
  ];

  return (
    <div className="space-y-6">
      {/* Loan Summary Card */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Loan Summary</CardTitle>
              <CardDescription>Final loan amount and repayment details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Banknote className="h-4 w-4" />
                <span className="text-sm">Approved Loan Amount</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(loanAmount)}</p>
              <p className="text-xs text-muted-foreground">Based on eligibility</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calculator className="h-4 w-4" />
                <span className="text-sm">Interest Amount</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(interestAmount)}</p>
              <p className="text-xs text-muted-foreground">@ {interestRate}% × {tenureDays} days</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calculator className="h-4 w-4" />
                <span className="text-sm">Processing Fee</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(processingFee)}</p>
              <p className="text-xs text-muted-foreground">@ {processingFeeRate}% of loan</p>
            </div>
            
            <div className="p-4 rounded-lg bg-primary/10 space-y-1 border border-primary/20">
              <div className="flex items-center gap-2 text-primary">
                <Banknote className="h-4 w-4" />
                <span className="text-sm font-medium">Net Disbursal</span>
              </div>
              <p className="text-2xl font-bold text-primary">{formatCurrency(netDisbursal)}</p>
              <p className="text-xs text-muted-foreground">After deductions</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Total Repayment</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalRepayment)}</p>
              <p className="text-xs text-muted-foreground">Principal + Interest</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Daily EMI</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(dailyEMI)}</p>
              <p className="text-xs text-muted-foreground">Over {tenureDays} days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loan Documents Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Loan Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {documentTypes.map((doc) => {
              const isGenerated = isDocGenerated(doc.key);
              const docRecord = generatedDocs?.find(d => d.document_type === doc.key);
              const isSigned = docRecord?.customer_signed;
              
              return (
                <Card key={doc.key} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className={`h-5 w-5 ${isSigned ? "text-green-600" : isGenerated ? "text-blue-600" : "text-primary"}`} />
                        <span className="font-medium text-sm">{doc.shortLabel}</span>
                      </div>
                      <div className="flex gap-1">
                        {isGenerated && !isSigned && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Check className="h-3 w-3" />
                            Generated
                          </Badge>
                        )}
                        {isSigned && (
                          <Badge className="gap-1 text-xs bg-green-500">
                            <FileCheck className="h-3 w-3" />
                            Signed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{doc.label}</p>
                    
                    {/* Action buttons row 1 */}
                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        size="sm"
                        variant={isGenerated ? "outline" : "default"}
                        className="w-full"
                        onClick={() => generateMutation.mutate(doc.key)}
                        disabled={generateMutation.isPending || isGenerated}
                        title="Generate"
                      >
                        {generateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handlePrint(doc.key)}
                        disabled={!isGenerated}
                        title="Print"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleDownload(doc.key)}
                        disabled={!isGenerated}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={!isGenerated}
                        title="Send"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Upload signed button */}
                    {isGenerated && !isSigned && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          setSelectedDocType(doc.key);
                          setUploadDialogOpen(true);
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Signed Document
                      </Button>
                    )}
                    
                    {isSigned && docRecord?.signed_document_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-green-600 border-green-200 hover:bg-green-50"
                        onClick={async () => {
                          const { data } = await supabase.storage
                            .from("loan-documents")
                            .createSignedUrl(docRecord.signed_document_path!, 60);
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, "_blank");
                          } else {
                            toast.error("Failed to get document URL");
                          }
                        }}
                      >
                        <FileCheck className="h-4 w-4 mr-2" />
                        View Signed Document
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hidden document templates for printing */}
      <div className="hidden">
        {sanction && (
          <>
            <div ref={(el) => { printRefs.current.sanction_letter = el; }}>
              <SanctionLetterDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                documentNumber={generatedDocs?.find(d => d.document_type === "sanction_letter")?.document_number || "SL-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName || "N/A"}
                borrowerAddress={borrowerAddress || "N/A"}
                loanAmount={loanAmount}
                tenure={tenureMonths}
                interestRate={interestRate}
                emi={monthlyEMI}
                processingFee={processingFee}
                gstOnProcessingFee={gstOnProcessingFee}
                validUntil={new Date(sanction.validity_date)}
                termsAndConditions={conditionsText ? conditionsText.split("\n").filter(Boolean) : defaultTerms}
              />
            </div>

            <div ref={(el) => { printRefs.current.loan_agreement = el; }}>
              <LoanAgreementDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                companyPhone={orgSettings?.company_phone}
                jurisdiction={orgSettings?.jurisdiction}
                documentNumber={generatedDocs?.find(d => d.document_type === "loan_agreement")?.document_number || "LA-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName || "N/A"}
                borrowerAddress={borrowerAddress || "N/A"}
                borrowerPhone={borrowerPhone || "N/A"}
                borrowerPAN={applicant?.pan_number}
                borrowerAadhaar={applicant?.aadhaar_number}
                loanAmount={loanAmount}
                tenure={tenureMonths}
                interestRate={interestRate}
                emi={monthlyEMI}
                firstEmiDate={firstEmiDate}
                processingFee={processingFee}
                foreclosureRate={orgSettings?.foreclosure_rate || 4}
                bounceCharges={500}
                penalInterest={24}
                bankName={bankDetails?.bank_name}
                accountNumber={bankDetails?.account_number}
                ifscCode={bankDetails?.ifsc_code}
              />
            </div>

            <div ref={(el) => { printRefs.current.daily_schedule = el; }}>
              <DailyRepaymentScheduleDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                documentNumber={generatedDocs?.find(d => d.document_type === "daily_schedule")?.document_number || "DRS-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName || "N/A"}
                borrowerAddress={borrowerAddress || "N/A"}
                borrowerPhone={borrowerPhone || "N/A"}
                loanAmount={loanAmount}
                dailyInterestRate={interestRate / 365}
                tenureDays={tenureDays}
                disbursementDate={new Date()}
                bankName={bankDetails?.bank_name}
                accountNumber={bankDetails?.account_number}
                grievanceEmail={orgSettings?.grievance_email}
                grievancePhone={orgSettings?.grievance_phone}
              />
            </div>
          </>
        )}
      </div>

      {/* Upload Signed Document Dialog */}
      {sanction && selectedDocType && (
        <UploadSignedDocumentDialog
          open={uploadDialogOpen}
          onOpenChange={(open) => {
            setUploadDialogOpen(open);
            if (!open) setSelectedDocType(null);
          }}
          applicationId={applicationId}
          sanctionId={sanction.id}
          orgId={application.org_id}
          documentType={selectedDocType}
          onSuccess={() => {
            refetchDocs();
            queryClient.invalidateQueries({ queryKey: ["loan-sanction", applicationId] });
          }}
        />
      )}
    </div>
  );
}
