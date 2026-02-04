import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, CheckCircle, XCircle, Eye, Shield, Loader2, Wand2, ChevronDown, ChevronRight, Sparkles, FileText } from "lucide-react";
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
  identity: "Identity Proof",
  address: "Address Proof",
  income: "Income Proof",
  bank: "Bank Statements",
  employment: "Employment Proof",
  other: "Other Documents",
};

const REQUIRED_DOCUMENTS = [
  { type: "pan_card", name: "PAN Card", category: "identity", mandatory: true, verifiable: false, parseable: true },
  { type: "aadhaar_card", name: "Aadhaar Card", category: "identity", mandatory: true, verifiable: false, parseable: true },
  { type: "photo", name: "Passport Photo", category: "identity", mandatory: true, verifiable: false, parseable: false },
  { type: "rental_agreement", name: "Rental Agreement", category: "address", mandatory: true, verifiable: false, parseable: true },
  { type: "utility_bill", name: "Utility Bill", category: "address", mandatory: true, verifiable: false, parseable: true },
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
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

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
    // Poll every 2 seconds if any document is being processed
    refetchInterval: (query) => {
      const docs = query.state.data as any[] | undefined;
      const hasProcessing = docs?.some((doc) => doc.parsing_status === 'processing');
      return hasProcessing ? 2000 : false;
    },
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

  // Fetch thumbnail URLs for uploaded documents
  useEffect(() => {
    const fetchThumbnails = async () => {
      const urls: Record<string, string> = {};
      for (const doc of documents) {
        // Only fetch for image types (not PDFs)
        const isImage = doc.mime_type?.startsWith("image/") || 
          /\.(jpg|jpeg|png|webp)$/i.test(doc.file_name || "");
        
        if (isImage && doc.file_path) {
          try {
            const { data } = await supabase.storage
              .from("loan-documents")
              .createSignedUrl(doc.file_path, 3600);
            if (data?.signedUrl) {
              urls[doc.document_type] = data.signedUrl;
            }
          } catch (err) {
            console.error("Failed to get thumbnail URL:", err);
          }
        }
      }
      setThumbnailUrls(urls);
    };

    if (documents.length > 0) {
      fetchThumbnails();
    }
  }, [documents]);

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
      
      // Invalidate application and applicant queries to reflect OCR-synced data
      queryClient.invalidateQueries({ queryKey: ["loan-application"] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      
      // Invalidate bank statement query to update Bank Details section
      if (data.docType === "bank_statement") {
        queryClient.invalidateQueries({ queryKey: ["bank-statement-parsed", applicationId] });
        queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicationId] });
      }
      
      // Check if processing in background (chunked parsing)
      if (data.status === "processing") {
        toast({ 
          title: "Document parsing started", 
          description: data.message || "Large document being processed in background...",
        });
      } else {
        toast({ title: "Document parsed successfully", description: "Data extracted using AI" });
      }
      setParsingDoc(null);
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
    queryClient.invalidateQueries({ queryKey: ["bank-statement-parsed", applicationId] });
    // Invalidate application and applicant queries to reflect OCR-synced data
    queryClient.invalidateQueries({ queryKey: ["loan-application"] });
    queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
    queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicationId] });
    
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
    const isProcessingInBackground = document?.parsing_status === 'processing';
    const hasParsedData = document?.ocr_data && !document.ocr_data.parse_error && !document.ocr_data.parsing_in_progress;
    const hasFailed = document?.parsing_status === 'failed';
    const progress = document?.parsing_progress as { current_page?: number; total_pages?: number; error?: string } | null;

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

    if (isParsing || isProcessingInBackground) {
      const tooltipText = isProcessingInBackground && progress?.total_pages && progress.total_pages > 1
        ? `Parsing page ${progress.current_page || 1} of ${progress.total_pages}...`
        : 'Parsing with AI...';
      
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" disabled className="h-8 w-8">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      );
    }

    if (hasFailed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => handleParse(docType, document.id, document.file_path)}
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Parsing failed{progress?.error ? `: ${progress.error}` : ''} - Click to retry
          </TooltipContent>
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

    // For API-verifiable docs (PAN, Aadhaar), now handled in ApplicantProfileCard
    // Allow manual approval only for other docs

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

  // Group documents by display column
  // Left column: identity + income, Right column: address + bank_employment
  const groupedDocs = REQUIRED_DOCUMENTS.reduce((acc, doc) => {
    // Merge bank and employment categories into one column
    const columnKey = doc.category === "bank" || doc.category === "employment" 
      ? "bank_employment" 
      : doc.category;
    if (!acc[columnKey]) acc[columnKey] = [];
    acc[columnKey].push(doc);
    return acc;
  }, {} as Record<string, typeof REQUIRED_DOCUMENTS>);

  // Define display order to control layout
  const categoryOrder = ["identity", "income", "address", "bank_employment"];

  // Custom category labels
  const getCategoryLabel = (category: string) => {
    if (category === "bank_employment") return "Bank & Employment";
    if (category === "identity") return "Identity Proof";
    if (category === "address") return "Address Proof";
    return DOCUMENT_CATEGORIES[category as keyof typeof DOCUMENT_CATEGORIES] || category;
  };

  // Helper to render document rows with sub-section headers for bank_employment
  const renderDocsWithSubsections = (docs: typeof REQUIRED_DOCUMENTS, category: string) => {
    if (category !== "bank_employment") {
      return docs;
    }
    
    // Group by original category for sub-sections
    const bankDocs = docs.filter(d => d.category === "bank");
    const employmentDocs = docs.filter(d => d.category === "employment");
    
    return { bankDocs, employmentDocs };
  };

  // Helper function to render a document row
  const renderDocumentRow = (doc: typeof REQUIRED_DOCUMENTS[0], document: any, isUploading: boolean, isVerified: boolean) => (
    <div
      key={doc.type}
      className={cn(
        "flex items-center gap-3 p-2 rounded-md border transition-colors",
        isVerified 
          ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" 
          : "border-border bg-muted/30"
      )}
    >
      {/* Thumbnail with hover view */}
      <div 
        className={cn(
          "relative h-10 w-10 rounded overflow-hidden flex-shrink-0 group cursor-pointer",
          document ? "bg-muted" : "bg-muted/50 border border-dashed border-muted-foreground/30"
        )}
        onClick={() => document && handleViewDocument(document.file_path, document.file_name)}
      >
        {document ? (
          <>
            {thumbnailUrls[doc.type] ? (
              <img 
                src={thumbnailUrls[doc.type]} 
                alt={doc.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            {/* Hover overlay with View */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye className="h-4 w-4 text-white" />
            </div>
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Upload className="h-4 w-4 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Document name and status */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isVerified ? (
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
        ) : document ? (
          <div className="h-4 w-4 rounded-full border-2 border-amber-400 flex-shrink-0" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
        )}
        <span className="text-sm truncate">{doc.name}</span>
        {doc.mandatory && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 flex-shrink-0">
            Req
          </Badge>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Verify */}
        {getVerifyIcon(doc.type, document)}

        {/* Upload */}
        <label htmlFor={`file-${doc.type}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={isUploading}
                asChild
              >
                <span>
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{document ? "Replace" : "Upload"}</TooltipContent>
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
      </div>
    </div>
  );

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
      <div className="space-y-3">
        {/* Parse All Documents button */}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleParseAll}
            disabled={isParsingAll || unparsedCount === 0}
            className="gap-2"
          >
            {isParsingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Parse All Documents
            {unparsedCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {unparsedCount}
              </Badge>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left column: Identity + Income */}
          <div className="space-y-4">
            {categoryOrder.filter(cat => cat !== "bank_employment" && cat !== "address").map((category) => {
              const docs = groupedDocs[category];
              if (!docs) return null;
              return (
                <Card key={category} className="h-fit">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">
                      {getCategoryLabel(category)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    {docs.map((doc) => {
                      const document = getDocument(doc.type);
                      const status = document?.verification_status || "pending";
                      const isUploading = uploadingDoc === doc.type;
                      const isVerified = status === "verified";
                      return renderDocumentRow(doc, document, isUploading, isVerified);
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Right column: Address Proof + Bank & Employment */}
          <div className="space-y-4">
            {/* Address Proof Section */}
            {groupedDocs["address"] && (
              <Card className="h-fit">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium">
                    {getCategoryLabel("address")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {groupedDocs["address"].map((doc) => {
                    const document = getDocument(doc.type);
                    const status = document?.verification_status || "pending";
                    const isUploading = uploadingDoc === doc.type;
                    const isVerified = status === "verified";
                    return renderDocumentRow(doc, document, isUploading, isVerified);
                  })}
                </CardContent>
              </Card>
            )}

            {/* Bank & Employment Section */}
            {groupedDocs["bank_employment"] && (
              <Card className="h-fit">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium">
                    {getCategoryLabel("bank_employment")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {/* Bank Statements Section */}
                  {groupedDocs["bank_employment"].filter(d => d.category === "bank").map((doc) => {
                    const document = getDocument(doc.type);
                    const status = document?.verification_status || "pending";
                    const isUploading = uploadingDoc === doc.type;
                    const isVerified = status === "verified";
                    return renderDocumentRow(doc, document, isUploading, isVerified);
                  })}
                  
                  {/* Employment Proof Sub-section */}
                  <div className="pt-2 mt-2 border-t border-border">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Employment Proof
                    </span>
                  </div>
                  {groupedDocs["bank_employment"].filter(d => d.category === "employment").map((doc) => {
                    const document = getDocument(doc.type);
                    const status = document?.verification_status || "pending";
                    const isUploading = uploadingDoc === doc.type;
                    const isVerified = status === "verified";
                    return renderDocumentRow(doc, document, isUploading, isVerified);
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
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
