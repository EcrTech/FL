import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SanctionGenerator from "./SanctionGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, Clock, FileText, Download, Printer, Loader2, Send, Check } from "lucide-react";
import { format, addMonths } from "date-fns";

// Document template imports
import KFSDocument from "./templates/KFSDocument";
import SanctionLetterDocument from "./templates/SanctionLetterDocument";
import LoanAgreementDocument from "./templates/LoanAgreementDocument";
import DPNDocument from "./templates/DPNDocument";

interface SanctionDashboardProps {
  applicationId: string;
  orgId: string;
}

type DocumentType = "kfs" | "sanction_letter" | "loan_agreement" | "dpn";

const documentTypes: { key: DocumentType; label: string; shortLabel: string }[] = [
  { key: "kfs", label: "Key Fact Statement", shortLabel: "KFS" },
  { key: "sanction_letter", label: "Sanction Letter", shortLabel: "Sanction" },
  { key: "loan_agreement", label: "Loan Agreement", shortLabel: "Agreement" },
  { key: "dpn", label: "Demand Promissory Note", shortLabel: "DPN" },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

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

// Helper to extract address from JSON
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

export default function SanctionDashboard({ applicationId, orgId }: SanctionDashboardProps) {
  const printRefs = useRef<Record<DocumentType, HTMLDivElement | null>>({
    kfs: null,
    sanction_letter: null,
    loan_agreement: null,
    dpn: null,
  });
  const queryClient = useQueryClient();

  const { data: sanction, isLoading } = useQuery({
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

  const { data: application } = useQuery({
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
  
  const { data: applicant } = useQuery<ApplicantData | null>({
    queryKey: ["primary-applicant", applicationId],
    queryFn: async () => {
      try {
        const session = await supabase.auth.getSession();
        const result = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/loan_applicants?loan_application_id=eq.${applicationId}&is_primary=eq.true&select=first_name,last_name,mobile,alternate_mobile,email,current_address,pan_number,aadhaar_number`,
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
    enabled: !!sanction,
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
    enabled: !!sanction,
  });

  // Fetch org settings
  const { data: orgSettings } = useQuery({
    queryKey: ["org-loan-settings", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_loan_settings")
        .select("*")
        .eq("org_id", orgId)
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
    enabled: !!sanction,
  });

  // Fetch existing generated documents
  const { data: generatedDocs } = useQuery({
    queryKey: ["generated-documents", applicationId, sanction?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_generated_documents")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("sanction_id", sanction!.id);
      return data || [];
    },
    enabled: !!sanction?.id,
  });

  // Generate document mutation
  const generateMutation = useMutation({
    mutationFn: async (docType: DocumentType) => {
      const docNumber = `${docType.toUpperCase().replace("_", "")}-${Date.now().toString(36).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from("loan_generated_documents")
        .insert({
          loan_application_id: applicationId,
          sanction_id: sanction!.id,
          org_id: orgId,
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Loading sanction details...</div>
        </CardContent>
      </Card>
    );
  }

  // If no sanction exists, show the generator
  if (!sanction) {
    return <SanctionGenerator applicationId={applicationId} orgId={orgId} />;
  }

  // Prepare common data
  const interestRate = sanction.sanctioned_rate || application?.interest_rate || 0;
  const tenureDays = sanction.sanctioned_tenure_days || 0;
  const tenureMonths = application?.tenure_months || Math.round(tenureDays / 30);
  const loanAmount = sanction.sanctioned_amount || application?.approved_amount || application?.requested_amount || 0;
  const processingFee = sanction.processing_fee || 0;
  const gstOnProcessingFee = processingFee * ((orgSettings?.gst_on_processing_fee || 18) / 100);
  const emi = calculateEMI(loanAmount, interestRate, tenureMonths);
  const totalRepayment = emi * tenureMonths;
  const totalInterest = totalRepayment - loanAmount;
  const apr = interestRate;
  const firstEmiDate = addMonths(new Date(), 1);
  const emiSchedule = generateEMISchedule(loanAmount, interestRate, tenureMonths, new Date());

  const borrowerName = applicant ? `${applicant.first_name} ${applicant.last_name || ""}`.trim() : "";
  const borrowerAddress = applicant ? formatAddress(applicant.current_address) : "";
  const borrowerPhone = applicant?.mobile || applicant?.alternate_mobile || "";

  const conditionsText = typeof sanction.conditions === 'string' 
    ? sanction.conditions 
    : typeof sanction.conditions === 'object' && sanction.conditions
      ? JSON.stringify(sanction.conditions, null, 2)
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
      {/* Sanction Details Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Sanction Details
            </CardTitle>
            <Badge variant="default" className="bg-primary">
              {sanction.sanction_number}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Sanctioned Amount</p>
              <p className="text-lg font-bold">{formatCurrency(sanction.sanctioned_amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Interest Rate</p>
              <p className="text-lg font-bold">{interestRate}% p.a.</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tenure</p>
              <p className="text-lg font-bold">{tenureDays} days</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Processing Fee</p>
              <p className="text-lg font-bold">{formatCurrency(processingFee)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valid Until</p>
              <p className="text-lg font-bold flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(sanction.validity_date), "dd MMM yyyy")}
              </p>
            </div>
          </div>
          
          {conditionsText && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Conditions</p>
              <p className="text-sm whitespace-pre-line">{conditionsText}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Loan Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {documentTypes.map((doc) => {
              const isGenerated = isDocGenerated(doc.key);
              return (
                <Card key={doc.key} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-medium text-sm">{doc.shortLabel}</span>
                      </div>
                      {isGenerated && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Check className="h-3 w-3" />
                          Generated
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{doc.label}</p>
                    <div className="flex gap-2">
                      {!isGenerated ? (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => generateMutation.mutate(doc.key)}
                          disabled={generateMutation.isPending}
                        >
                          {generateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-1" />
                              Generate
                            </>
                          )}
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handlePrint(doc.key)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            <Send className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hidden document templates for printing */}
      <div className="hidden">
        {applicant && (
          <>
            <div ref={(el) => { printRefs.current.kfs = el; }}>
              <KFSDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                documentNumber={generatedDocs?.find(d => d.document_type === "kfs")?.document_number || "KFS-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName}
                borrowerAddress={borrowerAddress}
                borrowerPhone={borrowerPhone}
                borrowerEmail={applicant.email || undefined}
                loanAmount={loanAmount}
                tenure={tenureMonths}
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
            </div>

            <div ref={(el) => { printRefs.current.sanction_letter = el; }}>
              <SanctionLetterDocument
                companyName={orgSettings?.company_name || "Paisaa Saarthi"}
                companyAddress={orgSettings?.company_address}
                companyCIN={orgSettings?.company_cin}
                documentNumber={generatedDocs?.find(d => d.document_type === "sanction_letter")?.document_number || "SL-DRAFT"}
                documentDate={new Date()}
                borrowerName={borrowerName}
                borrowerAddress={borrowerAddress}
                loanAmount={loanAmount}
                tenure={tenureMonths}
                interestRate={interestRate}
                emi={emi}
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
                borrowerName={borrowerName}
                borrowerAddress={borrowerAddress}
                borrowerPhone={borrowerPhone}
                borrowerPAN={applicant.pan_number}
                borrowerAadhaar={applicant.aadhaar_number}
                loanAmount={loanAmount}
                tenure={tenureMonths}
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
            </div>

            <div ref={(el) => { printRefs.current.dpn = el; }}>
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
                tenure={tenureMonths}
                interestRate={interestRate}
                totalRepayment={totalRepayment}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
