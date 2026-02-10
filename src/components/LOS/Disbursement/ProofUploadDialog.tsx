import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, FileCheck, X, Sparkles } from "lucide-react";

interface BankDetails {
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

interface ProofUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  sanctionId?: string;
  disbursementAmount?: number;
  bankDetails?: BankDetails;
  disbursementId?: string; // Optional - if provided, just upload proof
  onSuccess?: () => void;
}

export default function ProofUploadDialog({
  open,
  onOpenChange,
  applicationId,
  sanctionId,
  disbursementAmount,
  bankDetails,
  disbursementId,
  onSuccess,
}: ProofUploadDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      let targetDisbursementId = disbursementId;

      // If no disbursementId provided, create a new disbursement record first
      if (!targetDisbursementId) {
        if (!sanctionId) throw new Error("No sanction found");
        if (!disbursementAmount) throw new Error("No disbursement amount");
        if (!bankDetails?.accountNumber) throw new Error("Bank details not available");

        const disbursementNumber = `DISB${Date.now()}`;

        const { data: newDisbursement, error: insertError } = await supabase
          .from("loan_disbursements")
          .insert({
            loan_application_id: applicationId,
            sanction_id: sanctionId,
            disbursement_number: disbursementNumber,
            disbursement_amount: disbursementAmount,
            beneficiary_name: bankDetails.beneficiaryName,
            account_number: bankDetails.accountNumber,
            ifsc_code: bankDetails.ifscCode,
            bank_name: bankDetails.bankName,
            payment_mode: "neft",
            status: "pending",
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        targetDisbursementId = newDisbursement.id;
      }

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${targetDisbursementId}_proof_${Date.now()}.${fileExt}`;
      const filePath = `disbursement-proofs/${applicationId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Parse the uploaded document to extract UTR number and date
      let extractedUtr: string | null = null;
      let extractedDate: string | null = null;

      try {
        // Create a temporary document record for parsing
        const { data: docInsert, error: docError } = await supabase
          .from("loan_documents")
          .insert({
            loan_application_id: applicationId,
            document_type: "disbursement_proof",
            document_category: "other",
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            upload_status: "uploaded",
            verification_status: "pending",
          })
          .select("id")
          .single();

        if (!docError && docInsert) {
          // Parse the document to extract UTR data
          const { data: parseResult, error: parseError } = await supabase.functions.invoke(
            "parse-loan-document",
            {
              body: {
                documentId: docInsert.id,
                documentType: "disbursement_proof",
                filePath,
              },
            }
          );

          if (!parseError && parseResult?.success && parseResult.data) {
            extractedUtr = parseResult.data.utr_number || null;
            extractedDate = parseResult.data.transaction_date || null;
            console.log("[ProofUpload] Extracted UTR:", extractedUtr, "Date:", extractedDate);
          }
        }
      } catch (parseErr) {
        console.error("[ProofUpload] Error parsing UTR proof:", parseErr);
        // Continue even if parsing fails - manual entry is still possible
      }

      // Update disbursement record with extracted data
      const updateData: Record<string, unknown> = {
        proof_document_path: filePath,
        proof_uploaded_at: new Date().toISOString(),
        proof_uploaded_by: userId,
        updated_at: new Date().toISOString(),
        status: "completed",
      };

      // Add extracted UTR data if available
      if (extractedUtr) {
        updateData.utr_number = extractedUtr;
      }
      if (extractedDate) {
        updateData.disbursement_date = extractedDate;
      } else {
        updateData.disbursement_date = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("loan_disbursements")
        .update(updateData)
        .eq("id", targetDisbursementId);

      if (updateError) throw updateError;

      // Update loan application stage - guarded transition
      const { data: transitioned, error: stageError } = await supabase
        .rpc("transition_loan_stage", {
          p_application_id: applicationId,
          p_expected_current_stage: "disbursement_pending",
          p_new_stage: "disbursed",
        });

      if (stageError) throw stageError;
      if (!transitioned) throw new Error("Application stage has changed. Please refresh.");

      return { extractedUtr, extractedDate };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["loan-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["unified-disbursals"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      
      if (data.extractedUtr) {
        toast.success(`Disbursement completed! UTR: ${data.extractedUtr}`);
      } else {
        toast.success("Proof uploaded and disbursement marked as completed");
      }
      
      setFile(null);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Please upload a PDF or image file");
        return;
      }
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload UTR Proof
          </DialogTitle>
          <DialogDescription>
            Upload the UTR confirmation or bank transfer proof. The UTR number and date will be automatically extracted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-primary/10 rounded-lg flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5" />
            <div className="text-sm">
              <span className="font-medium">AI-Powered Extraction</span>
              <p className="text-muted-foreground text-xs mt-0.5">
                UTR number and transaction date will be automatically extracted from the uploaded document.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proof-file">Proof Document</Label>
            <Input
              id="proof-file"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Accepted formats: PDF, JPG, PNG (max 10MB)
            </p>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={!file || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Complete
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
