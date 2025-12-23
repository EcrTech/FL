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
import { Upload, Loader2, FileCheck, X } from "lucide-react";

interface ProofUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disbursementId: string;
  applicationId: string;
  onSuccess?: () => void;
}

export default function ProofUploadDialog({
  open,
  onOpenChange,
  disbursementId,
  applicationId,
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

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${disbursementId}_proof_${Date.now()}.${fileExt}`;
      const filePath = `disbursement-proofs/${applicationId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update disbursement record
      const { error: updateError } = await supabase
        .from("loan_disbursements")
        .update({
          proof_document_path: filePath,
          proof_uploaded_at: new Date().toISOString(),
          proof_uploaded_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", disbursementId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["all-disbursements"] });
      toast.success("Proof of disbursement uploaded successfully");
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
            Upload Proof of Disbursement
          </DialogTitle>
          <DialogDescription>
            Upload a screenshot or document showing proof of the fund transfer (e.g., bank statement, UTR confirmation).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Proof
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
