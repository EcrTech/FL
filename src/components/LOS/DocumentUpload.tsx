import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, CheckCircle, XCircle, Eye, Shield, Loader2, Wand2, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Applicant {
  first_name: string;
  last_name?: string;
  mobile?: string;
  pan_number?: string;
}

interface DocumentUploadProps {
  applicationId: string;
  orgId: string;
  applicant?: Applicant;
}

const DOCUMENT_CATEGORIES = {
  address: "Address Proof",
  income: "Income Proof",
  bank: "Bank Statements",
  employment: "Employment Proof",
  photo: "Photographs",
  other: "Other Documents",
};

const REQUIRED_DOCUMENTS = [
  { type: "salary_slip_1", name: "Salary Slip - Month 1", category: "income", mandatory: true, verifiable: false, parseable: true },
  { type: "salary_slip_2", name: "Salary Slip - Month 2", category: "income", mandatory: true, verifiable: false, parseable: true },
  { type: "salary_slip_3", name: "Salary Slip - Month 3", category: "income", mandatory: true, verifiable: false, parseable: true },
  { type: "form_16_year_1", name: "Form 16 (Current Year)", category: "income", mandatory: true, verifiable: false, parseable: true },
  { type: "form_16_year_2", name: "Form 16 (Previous Year)", category: "income", mandatory: true, verifiable: false, parseable: true },
  { type: "itr_year_1", name: "ITR (Current Year)", category: "income", mandatory: false, verifiable: false, parseable: true },
  { type: "itr_year_2", name: "ITR (Previous Year)", category: "income", mandatory: false, verifiable: false, parseable: true },
  { type: "bank_statement", name: "Bank Statement (6 months)", category: "bank", mandatory: true, verifiable: false, parseable: true },
  { type: "offer_letter", name: "Offer Letter", category: "employment", mandatory: true, verifiable: false, parseable: true },
  { type: "employee_id", name: "Employee ID Card", category: "employment", mandatory: false, verifiable: false, parseable: true },
  { type: "passport_photo", name: "Passport Size Photo", category: "photo", mandatory: true, verifiable: false, parseable: false },
];

// Map document types to verification types (only for bank statement now)
const DOC_TO_VERIFICATION_TYPE: Record<string, string> = {
  bank_statement: "bank_statement",
};

export default function DocumentUpload({ applicationId, orgId, applicant }: DocumentUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [verifyingDoc, setVerifyingDoc] = useState<string | null>(null);
  const [parsingDoc, setParsingDoc] = useState<string | null>(null);
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; url: string | null; name: string }>({
    open: false,
    url: null,
    name: "",
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isParsingAll, setIsParsingAll] = useState(false);

  const { data: documents = [] } = useQuery({
    queryKey: ["loan-documents", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  // Fetch verifications for this application
  const { data: verifications = [] } = useQuery({
    queryKey: ["loan-verifications", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_verifications")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const getVerification = (verificationType: string) => {
    return verifications.find((v) => v.verification_type === verificationType);
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ docType, file }: { docType: string; file: File }) => {
      const fileExt = file.name.split(".").pop();
      const filePath = `${orgId}/${applicationId}/${docType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("loan_documents").insert({
        loan_application_id: applicationId,
        document_type: docType,
        document_category: REQUIRED_DOCUMENTS.find((d) => d.type === docType)?.category || "other",
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        upload_status: "uploaded",
        verification_status: "pending",
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
      toast({ title: "Document uploaded successfully" });
      setUploadingDoc(null);
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploadingDoc(null);
    },
  });

  const handleFileSelect = (docType: string, file: File) => {
    setUploadingDoc(docType);
    uploadMutation.mutate({ docType, file });
  };


  const parseMutation = useMutation({
    mutationFn: async ({ docType, docId, filePath }: { docType: string; docId: string; filePath: string }) => {
      setParsingDoc(docType);
      
      const { data, error } = await supabase.functions.invoke("parse-loan-document", {
        body: { documentId: docId, documentType: docType, filePath },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Parsing failed");
      
      return { ...data, docType };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
      toast({ title: "Document parsed successfully", description: "Data extracted using AI" });
      setParsingDoc(null);

      // Auto-trigger bank verification after bank_statement OCR
      if (data.docType === "bank_statement" && data.data) {
        const { account_number, ifsc_code, account_holder_name } = data.data;
        if (account_number && ifsc_code) {
          try {
            // First authenticate with Sandbox
            const { data: authData, error: authError } = await supabase.functions.invoke("sandbox-authenticate");
            if (authError || !authData?.access_token) {
              console.error("[DocumentUpload] Bank verification auth failed:", authError);
              return;
            }

            // Auto-verify bank account using penny-less verification
            const { data: verifyResult, error: verifyError } = await supabase.functions.invoke("sandbox-bank-verify", {
              body: {
                accountNumber: account_number,
                ifscCode: ifsc_code,
                applicationId,
                orgId,
                accessToken: authData.access_token,
                verifyType: "pennyless",
              },
            });

            if (verifyError) {
              console.error("[DocumentUpload] Bank verification failed:", verifyError);
            } else if (verifyResult?.success) {
              queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
              toast({ 
                title: "Bank account verified", 
                description: `Account holder: ${verifyResult.data?.account_holder_name || account_holder_name || "Verified"}` 
              });
            }
          } catch (err) {
            console.error("[DocumentUpload] Auto bank verification error:", err);
          }
        }
      }
    },
    onError: (error: any) => {
      toast({ title: "Parsing failed", description: error.message, variant: "destructive" });
      setParsingDoc(null);
    },
  });

  const handleParse = (docType: string, docId: string, filePath: string) => {
    parseMutation.mutate({ docType, docId, filePath });
  };

  // Parse all unparsed documents
  const handleParseAll = async () => {
    const parseableDocTypes = REQUIRED_DOCUMENTS.filter((d) => d.parseable).map((d) => d.type);
    const unparsedDocs = documents.filter((doc) => {
      if (!parseableDocTypes.includes(doc.document_type)) return false;
      const ocr = doc.ocr_data as Record<string, any> | null;
      // Include if no OCR data or if it has a parse error or if all values are empty/0
      if (!ocr || Object.keys(ocr).length === 0) return true;
      if (ocr.parse_error) return true;
      return false;
    });

    if (unparsedDocs.length === 0) {
      toast({ title: "All documents already parsed", description: "No documents need parsing" });
      return;
    }

    setIsParsingAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (const doc of unparsedDocs) {
      try {
        const { data, error } = await supabase.functions.invoke("parse-loan-document", {
          body: { documentId: doc.id, documentType: doc.document_type, filePath: doc.file_path },
        });

        if (error || !data.success) {
          console.error(`Failed to parse ${doc.document_type}:`, error || data.error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Error parsing ${doc.document_type}:`, err);
        errorCount++;
      }
    }

    setIsParsingAll(false);
    queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
    
    if (errorCount === 0) {
      toast({ title: "All documents parsed", description: `Successfully parsed ${successCount} documents` });
    } else {
      toast({ 
        title: "Parsing completed with errors", 
        description: `Parsed ${successCount}, failed ${errorCount}`,
        variant: errorCount > successCount ? "destructive" : "default"
      });
    }
  };
  const handleViewDocument = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("loan-documents")
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      setPreviewDialog({ open: true, url: data.signedUrl, name: fileName });
    } catch (error: any) {
      toast({ title: "Failed to load document", description: error.message, variant: "destructive" });
    }
  };

  const getDocument = (docType: string) => {
    return documents.find((d) => d.document_type === docType);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
      case "success":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Verified</Badge>;
      case "rejected":
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "uploaded":
      case "in_progress":
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const toggleRowExpanded = (docType: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docType)) {
        newSet.delete(docType);
      } else {
        newSet.add(docType);
      }
      return newSet;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderVerificationDetails = (verificationType: string) => {
    const verification = getVerification(verificationType);
    if (!verification || verification.status !== "success") return null;

    const responseData = verification.response_data as Record<string, any> | null;
    if (!responseData) return null;

    const renderDetailRow = (label: string, value: any, highlight = false) => {
      if (value === null || value === undefined || value === "") return null;
      return (
        <div className="flex justify-between items-center py-1 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className={cn("font-medium", highlight && "text-green-600")}>{value}</span>
        </div>
      );
    };

    switch (verificationType) {
      case "pan":
        return (
          <div className="space-y-1">
            {renderDetailRow("PAN Number", responseData.pan_number)}
            {renderDetailRow("Name on PAN", responseData.name_on_pan)}
            {renderDetailRow("PAN Status", responseData.pan_status, responseData.pan_status === "Valid")}
            {renderDetailRow("Name Match", responseData.name_match_result, responseData.name_match_result === "Match")}
          </div>
        );

      case "aadhaar":
        return (
          <div className="space-y-1">
            {renderDetailRow("Last 4 Digits", responseData.aadhaar_last_4 ? `XXXX-XXXX-${responseData.aadhaar_last_4}` : null)}
            {renderDetailRow("Status", responseData.status, responseData.status === "Verified")}
            {renderDetailRow("Address Match", responseData.address_match_result)}
          </div>
        );

      case "credit_bureau":
        return (
          <div className="space-y-1">
            {renderDetailRow("Credit Score", responseData.credit_score, (responseData.credit_score || 0) >= 700)}
            {renderDetailRow("Bureau", responseData.bureau_type)}
            {renderDetailRow("Active Accounts", responseData.active_accounts)}
            {renderDetailRow("Total Outstanding", responseData.total_outstanding ? formatCurrency(responseData.total_outstanding) : null)}
            {renderDetailRow("Total Overdue", responseData.total_overdue ? formatCurrency(responseData.total_overdue) : null)}
            {renderDetailRow("Enquiries (30d)", responseData.enquiry_last_30_days)}
            {renderDetailRow("Enquiries (90d)", responseData.enquiry_last_90_days)}
            {renderDetailRow("Max DPD", responseData.max_dpd_history)}
          </div>
        );

      case "video_kyc":
        return (
          <div className="space-y-1">
            {renderDetailRow("Session Status", responseData.session_status, responseData.session_status === "completed")}
            {renderDetailRow("Recording", responseData.recording_available ? "Available" : "Not Available")}
            {renderDetailRow("Meeting ID", responseData.meeting_id)}
          </div>
        );

      case "bank_account":
        return (
          <div className="space-y-1">
            {renderDetailRow("Account Holder", responseData.account_holder_name)}
            {renderDetailRow("Bank Name", responseData.bank_name)}
            {renderDetailRow("Branch", responseData.branch_name)}
            {renderDetailRow("Account Type", responseData.account_type)}
          </div>
        );

      case "employment":
        return (
          <div className="space-y-1">
            {renderDetailRow("Membership Status", responseData.membership_status, responseData.membership_status === "Active")}
            {renderDetailRow("Employer", responseData.employer_name)}
            {renderDetailRow("Employer Match", responseData.employer_match_result)}
            {renderDetailRow("Last Contribution", responseData.last_contribution_date)}
          </div>
        );

      case "bank_statement":
        return (
          <div className="space-y-1">
            {renderDetailRow("Avg Monthly Balance", responseData.average_monthly_balance ? formatCurrency(responseData.average_monthly_balance) : null)}
            {renderDetailRow("Bounce Count", responseData.bounce_count)}
            {renderDetailRow("FOIR Calculated", responseData.foir_calculated ? `${(responseData.foir_calculated * 100).toFixed(1)}%` : null)}
          </div>
        );

      default:
        return null;
    }
  };

  const getParseIcon = (docType: string, document: any) => {
    const docConfig = REQUIRED_DOCUMENTS.find((d) => d.type === docType);
    if (!docConfig?.parseable) return null;

    const isParsing = parsingDoc === docType;
    const hasParsedData = document?.ocr_data && !document.ocr_data.parse_error;

    if (!document) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled>
              <Wand2 className="h-4 w-4 text-muted-foreground/40" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload document first to parse</TooltipContent>
        </Tooltip>
      );
    }

    if (isParsing) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" disabled className="h-8 w-8">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Parsing with AI...</TooltipContent>
        </Tooltip>
      );
    }

    if (hasParsedData) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-8 w-8"
              onClick={() => handleParse(docType, document.id, document.file_path)}
            >
              <CheckCircle className="h-4 w-4 text-green-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Parsed - Click to re-parse</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => handleParse(docType, document.id, document.file_path)}
          >
            <Wand2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Parse with AI</TooltipContent>
      </Tooltip>
    );
  };

  // Manual approval mutation (for documents without API verification)
  const approveMutation = useMutation({
    mutationFn: async ({ docId }: { docId: string }) => {
      const { error: updateError } = await supabase
        .from("loan_documents")
        .update({
          verification_status: "verified",
          verified_at: new Date().toISOString(),
        })
        .eq("id", docId);

      if (updateError) throw updateError;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
      toast({ title: "Document approved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    },
  });

  const handleApprove = (docId: string) => {
    approveMutation.mutate({ docId });
  };

  const getVerifyIcon = (docType: string, document: any) => {
    const docConfig = REQUIRED_DOCUMENTS.find((d) => d.type === docType);
    const isApiVerifiable = docConfig?.verifiable;

    if (!document) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled>
              <CheckCircle className="h-4 w-4 text-muted-foreground/40" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload document first to approve</TooltipContent>
        </Tooltip>
      );
    }

    const isVerifying = verifyingDoc === docType;
    const isApproving = approveMutation.isPending;
    const status = document.verification_status;

    if (isVerifying || isApproving) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" disabled className="h-8 w-8">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isApiVerifiable ? "Verifying..." : "Approving..."}</TooltipContent>
        </Tooltip>
      );
    }

    if (status === "verified") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 cursor-default">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Verified</TooltipContent>
        </Tooltip>
      );
    }

    if (status === "rejected") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 cursor-default">
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rejected: {document.rejection_reason || "No reason provided"}</TooltipContent>
        </Tooltip>
      );
    }

    // For API-verifiable docs (PAN, Aadhaar), use API verification
    if (isApiVerifiable) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => handleVerify(docType, document.id)}
            >
              <Shield className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Verify via API</TooltipContent>
        </Tooltip>
      );
    }

    // For other docs, allow manual approval
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => handleApprove(document.id)}
          >
            <CheckCircle className="h-4 w-4 text-muted-foreground hover:text-green-500" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mark as verified</TooltipContent>
      </Tooltip>
    );
  };

  const groupedDocs = REQUIRED_DOCUMENTS.reduce((acc, doc) => {
    const category = doc.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, typeof REQUIRED_DOCUMENTS>);

  // Count documents that need parsing
  const parseableDocTypes = REQUIRED_DOCUMENTS.filter((d) => d.parseable).map((d) => d.type);
  const unparsedCount = documents.filter((doc) => {
    if (!parseableDocTypes.includes(doc.document_type)) return false;
    const ocr = doc.ocr_data as Record<string, any> | null;
    if (!ocr || Object.keys(ocr).length === 0) return true;
    if (ocr.parse_error) return true;
    return false;
  }).length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Parse All Button */}
        {unparsedCount > 0 && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleParseAll}
              disabled={isParsingAll}
              className="gap-2"
            >
              {isParsingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isParsingAll ? "Parsing..." : `Parse All Documents (${unparsedCount})`}
            </Button>
          </div>
        )}
        {Object.entries(groupedDocs).map(([category, docs]) => (
          <Card key={category}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">
                {DOCUMENT_CATEGORIES[category as keyof typeof DOCUMENT_CATEGORIES]}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Document</TableHead>
                    <TableHead className="w-[25%]">Status</TableHead>
                    <TableHead className="text-right w-[35%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => {
                    const document = getDocument(doc.type);
                    const isVerificationDoc = (doc as any).isVerification;
                    const verificationType = DOC_TO_VERIFICATION_TYPE[doc.type];
                    const verification = verificationType ? getVerification(verificationType) : null;
                    const status = isVerificationDoc 
                      ? (verification?.status || "pending") 
                      : (document?.verification_status || "pending");
                    const isUploading = uploadingDoc === doc.type;
                    const isExpanded = expandedRows.has(doc.type);
                    const hasVerificationDetails = verification?.status === "success" && verification?.response_data;

                    return (
                      <Collapsible key={doc.type} asChild open={isExpanded}>
                        <>
                          <TableRow className={cn(hasVerificationDetails && "cursor-pointer hover:bg-muted/50")} onClick={() => hasVerificationDetails && toggleRowExpanded(doc.type)}>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                {hasVerificationDetails && (
                                  <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                )}
                                <span className="text-sm">{doc.name}</span>
                                {doc.mandatory && (
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    Req
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              {getStatusBadge(status)}
                              {verification?.verified_at && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {format(new Date(verification.verified_at), "MMM d, h:mm a")}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                {!isVerificationDoc && (
                                  <>
                                  <>
                                    {/* Eye icon - View document */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          disabled={!document}
                                          onClick={() => document && handleViewDocument(document.file_path, document.file_name)}
                                        >
                                          <Eye className={cn("h-4 w-4", !document && "text-muted-foreground/40")} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{document ? "View document" : "No document uploaded"}</TooltipContent>
                                    </Tooltip>

                                    {/* Parse icon */}
                                    {getParseIcon(doc.type, document)}

                                    {/* Verify icon */}
                                    {getVerifyIcon(doc.type, document)}

                                    {/* Upload button */}
                                    <label htmlFor={`file-${doc.type}`}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            disabled={isUploading}
                                            asChild
                                          >
                                            <span>
                                              {isUploading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Upload className="h-4 w-4" />
                                              )}
                                            </span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{document ? "Replace document" : "Upload document"}</TooltipContent>
                                      </Tooltip>
                                    </label>
                                    <input
                                      id={`file-${doc.type}`}
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.jpg,.jpeg,.png"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileSelect(doc.type, file);
                                        e.target.value = "";
                                      }}
                                    />
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {hasVerificationDetails && (
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={3} className="py-3 px-6">
                                  <div className="max-w-md">
                                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Verified Details</h4>
                                    {renderVerificationDetails(verificationType)}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          )}
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ ...previewDialog, open })}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewDialog.name}</DialogTitle>
          </DialogHeader>
          {previewDialog.url && (
            <div className="flex-1 overflow-auto">
              {previewDialog.name.toLowerCase().endsWith(".pdf") ? (
                <iframe src={previewDialog.url} className="w-full h-[70vh]" title="Document Preview" />
              ) : (
                <img src={previewDialog.url} alt={previewDialog.name} className="max-w-full h-auto" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
