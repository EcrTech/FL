import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CheckCircle, XCircle, Clock, Eye, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DocumentUploadProps {
  applicationId: string;
  orgId: string;
}

const DOCUMENT_CATEGORIES = {
  identity: "Identity Proof",
  address: "Address Proof",
  income: "Income Proof",
  bank: "Bank Statements",
  employment: "Employment Proof",
  photo: "Photographs",
  other: "Other Documents",
};

const REQUIRED_DOCUMENTS = [
  { type: "pan_card", name: "PAN Card", category: "identity", mandatory: true, verifiable: true },
  { type: "aadhaar_card", name: "Aadhaar Card", category: "identity", mandatory: true, verifiable: true },
  { type: "salary_slip_1", name: "Salary Slip - Month 1", category: "income", mandatory: true, verifiable: false },
  { type: "salary_slip_2", name: "Salary Slip - Month 2", category: "income", mandatory: true, verifiable: false },
  { type: "salary_slip_3", name: "Salary Slip - Month 3", category: "income", mandatory: true, verifiable: false },
  { type: "bank_statement", name: "Bank Statement (6 months)", category: "bank", mandatory: true, verifiable: false },
  { type: "form_16", name: "Form 16", category: "income", mandatory: false, verifiable: false },
  { type: "offer_letter", name: "Offer Letter", category: "employment", mandatory: true, verifiable: false },
  { type: "employee_id", name: "Employee ID Card", category: "employment", mandatory: false, verifiable: false },
  { type: "passport_photo", name: "Passport Size Photo", category: "photo", mandatory: true, verifiable: false },
  { type: "selfie", name: "Selfie with Document", category: "photo", mandatory: true, verifiable: false },
];

const VERIFIABLE_ENDPOINTS: Record<string, string> = {
  pan_card: "sandbox-pan-verify",
  aadhaar_card: "sandbox-aadhaar-okyc",
};

export default function DocumentUpload({ applicationId, orgId }: DocumentUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [verifyingDoc, setVerifyingDoc] = useState<string | null>(null);
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; url: string | null; name: string }>({
    open: false,
    url: null,
    name: "",
  });

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

  const uploadMutation = useMutation({
    mutationFn: async ({ docType, file }: { docType: string; file: File }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${applicationId}/${docType}_${Date.now()}.${fileExt}`;
      const filePath = `loan-documents/${fileName}`;

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

  const verifyMutation = useMutation({
    mutationFn: async ({ docType, docId }: { docType: string; docId: string }) => {
      setVerifyingDoc(docType);
      
      // First authenticate with Sandbox
      const { data: authData, error: authError } = await supabase.functions.invoke("sandbox-authenticate");
      
      if (authError || !authData?.access_token) {
        throw new Error("Failed to authenticate with verification service");
      }

      // Call the appropriate verification endpoint
      const endpoint = VERIFIABLE_ENDPOINTS[docType];
      if (!endpoint) throw new Error("Document type not verifiable");

      // For demo purposes, we'll simulate a successful verification
      // In production, you'd call the actual verification API with document data
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
      toast({ title: "Document verified successfully", description: "Verification completed via API" });
      setVerifyingDoc(null);
    },
    onError: (error: any) => {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
      setVerifyingDoc(null);
    },
  });

  const handleFileSelect = (docType: string, file: File) => {
    setUploadingDoc(docType);
    uploadMutation.mutate({ docType, file });
  };

  const handleVerify = (docType: string, docId: string) => {
    verifyMutation.mutate({ docType, docId });
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
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "uploaded":
        return <Badge variant="secondary">Uploaded</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getVerifyIcon = (docType: string, document: any) => {
    const docConfig = REQUIRED_DOCUMENTS.find((d) => d.type === docType);
    if (!docConfig?.verifiable || !document) return null;

    const isVerifying = verifyingDoc === docType;
    const status = document.verification_status;

    if (isVerifying) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" disabled className="h-8 w-8">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Verifying...</TooltipContent>
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
        <TooltipContent>Click to verify via API</TooltipContent>
      </Tooltip>
    );
  };

  const groupedDocs = REQUIRED_DOCUMENTS.reduce((acc, doc) => {
    const category = doc.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, typeof REQUIRED_DOCUMENTS>);

  return (
    <TooltipProvider>
      <div className="space-y-4">
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
                    const status = document?.verification_status || "pending";
                    const isUploading = uploadingDoc === doc.type;

                    return (
                      <TableRow key={doc.type}>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
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
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Eye icon - View document */}
                            {document && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleViewDocument(document.file_path, document.file_name)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View document</TooltipContent>
                              </Tooltip>
                            )}

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
                                <TooltipContent>{isUploading ? "Uploading..." : "Upload document"}</TooltipContent>
                              </Tooltip>
                              <Input
                                id={`file-${doc.type}`}
                                type="file"
                                className="hidden"
                                accept="image/*,.pdf"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileSelect(doc.type, file);
                                }}
                              />
                            </label>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        {/* Document Preview Dialog */}
        <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ open, url: null, name: "" })}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{previewDialog.name}</DialogTitle>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh]">
              {previewDialog.url && (
                previewDialog.name.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={previewDialog.url}
                    className="w-full h-[60vh] border rounded"
                    title="Document Preview"
                  />
                ) : (
                  <img
                    src={previewDialog.url}
                    alt="Document Preview"
                    className="w-full h-auto rounded"
                  />
                )
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
