import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  { type: "pan_card", name: "PAN Card", category: "identity", mandatory: true },
  { type: "aadhaar_card", name: "Aadhaar Card", category: "identity", mandatory: true },
  { type: "salary_slip_1", name: "Salary Slip - Month 1", category: "income", mandatory: true },
  { type: "salary_slip_2", name: "Salary Slip - Month 2", category: "income", mandatory: true },
  { type: "salary_slip_3", name: "Salary Slip - Month 3", category: "income", mandatory: true },
  { type: "bank_statement", name: "Bank Statement (6 months)", category: "bank", mandatory: true },
  { type: "form_16", name: "Form 16", category: "income", mandatory: false },
  { type: "offer_letter", name: "Offer Letter", category: "employment", mandatory: true },
  { type: "employee_id", name: "Employee ID Card", category: "employment", mandatory: false },
  { type: "passport_photo", name: "Passport Size Photo", category: "photo", mandatory: true },
  { type: "selfie", name: "Selfie with Document", category: "photo", mandatory: true },
];

const STATUS_CONFIG = {
  pending: { color: "bg-muted", icon: Clock, label: "Pending" },
  uploaded: { color: "bg-blue-500", icon: Clock, label: "Uploaded" },
  verified: { color: "bg-green-500", icon: CheckCircle, label: "Verified" },
  rejected: { color: "bg-red-500", icon: XCircle, label: "Rejected" },
};

export default function DocumentUpload({ applicationId, orgId }: DocumentUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [verifyDialog, setVerifyDialog] = useState<{ open: boolean; document: any }>({
    open: false,
    document: null,
  });
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: documents = [], isLoading } = useQuery({
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

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
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
      setSelectedFile(null);
      setUploadingDoc(null);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadingDoc(null);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({
      docId,
      status,
      reason,
    }: {
      docId: string;
      status: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("loan_documents")
        .update({
          verification_status: status,
          rejection_reason: reason,
          verified_at: new Date().toISOString(),
        })
        .eq("id", docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
      toast({ title: "Document verification updated" });
      setVerifyDialog({ open: false, document: null });
      setRejectionReason("");
    },
  });

  const handleFileSelect = (docType: string, file: File) => {
    setSelectedFile(file);
    setUploadingDoc(docType);
    uploadMutation.mutate({ docType, file });
  };

  const getDocumentStatus = (docType: string) => {
    const doc = documents.find((d) => d.document_type === docType);
    return doc ? doc.verification_status : "pending";
  };

  const getDocument = (docType: string) => {
    return documents.find((d) => d.document_type === docType);
  };

  const groupedDocs = REQUIRED_DOCUMENTS.reduce((acc, doc) => {
    const category = doc.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, typeof REQUIRED_DOCUMENTS>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedDocs).map(([category, docs]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{DOCUMENT_CATEGORIES[category as keyof typeof DOCUMENT_CATEGORIES]}</CardTitle>
            <CardDescription>
              {docs.filter((d) => d.mandatory).length} mandatory documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {docs.map((doc) => {
                const status = getDocumentStatus(doc.type);
                const document = getDocument(doc.type);
                const StatusIcon = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].icon;

                return (
                  <div
                    key={doc.type}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{doc.name}</p>
                          {doc.mandatory && (
                            <Badge variant="outline" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusIcon className="h-3 w-3" />
                          <Badge
                            variant="secondary"
                            className={STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].color}
                          >
                            {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].label}
                          </Badge>
                        </div>
                        {document?.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1">{document.rejection_reason}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {document && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setVerifyDialog({ open: true, document })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <label htmlFor={`file-${doc.type}`}>
                        <Button
                          size="sm"
                          variant={status === "pending" ? "default" : "outline"}
                          disabled={uploadingDoc === doc.type}
                          asChild
                        >
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingDoc === doc.type ? "Uploading..." : "Upload"}
                          </span>
                        </Button>
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
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Verification Dialog */}
      <Dialog open={verifyDialog.open} onOpenChange={(open) => setVerifyDialog({ open, document: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Document</DialogTitle>
            <DialogDescription>
              Review and verify the uploaded document
            </DialogDescription>
          </DialogHeader>

          {verifyDialog.document && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Document Type</label>
                <p className="text-sm text-muted-foreground">
                  {REQUIRED_DOCUMENTS.find((d) => d.type === verifyDialog.document.document_type)?.name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">File Name</label>
                <p className="text-sm text-muted-foreground">{verifyDialog.document.file_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Current Status</label>
                <p className="text-sm text-muted-foreground">{verifyDialog.document.verification_status}</p>
              </div>

              {verifyDialog.document.verification_status === "pending" && (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Rejection reason (if rejecting)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {verifyDialog.document?.verification_status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    verifyMutation.mutate({
                      docId: verifyDialog.document.id,
                      status: "rejected",
                      reason: rejectionReason,
                    })
                  }
                  disabled={!rejectionReason}
                >
                  Reject
                </Button>
                <Button
                  onClick={() =>
                    verifyMutation.mutate({
                      docId: verifyDialog.document.id,
                      status: "verified",
                    })
                  }
                >
                  Verify
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
