import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CreditBureauDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function CreditBureauDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: CreditBureauDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    bureau_type: existingVerification?.response_data?.bureau_type || "cibil",
    credit_score: existingVerification?.response_data?.credit_score || "",
    active_accounts: existingVerification?.response_data?.active_accounts || "0",
    total_outstanding: existingVerification?.response_data?.total_outstanding || "",
    total_overdue: existingVerification?.response_data?.total_overdue || "",
    enquiry_count_30d: existingVerification?.response_data?.enquiry_count_30d || "0",
    enquiry_count_90d: existingVerification?.response_data?.enquiry_count_90d || "0",
    dpd_history: existingVerification?.response_data?.dpd_history || "",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
    report_file_path: existingVerification?.response_data?.report_file_path || "",
    name_on_report: existingVerification?.response_data?.name_on_report || "",
    pan_on_report: existingVerification?.response_data?.pan_on_report || "",
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedSuccessfully, setParsedSuccessfully] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }
      setUploadedFile(file);
      setParsedSuccessfully(false);
    }
  };

  const uploadAndParseFile = async () => {
    if (!uploadedFile) return null;

    setIsUploading(true);
    try {
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${applicationId}/cibil_report_${Date.now()}.${fileExt}`;
      
      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, uploadedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;
      
      setIsUploading(false);
      setIsParsing(true);

      // Call edge function to parse the report with AI
      const { data: parseResult, error: parseError } = await supabase.functions
        .invoke("parse-cibil-report", {
          body: { 
            filePath: uploadData.path,
            applicationId 
          }
        });

      if (parseError) {
        console.error("Parse error:", parseError);
        throw new Error("Failed to parse CIBIL report");
      }

      if (!parseResult.success) {
        throw new Error(parseResult.error || "Failed to parse report");
      }

      // Update form with parsed data
      const parsed = parseResult.data;
      setFormData(prev => ({
        ...prev,
        bureau_type: parsed.bureau_type || prev.bureau_type,
        credit_score: parsed.credit_score?.toString() || prev.credit_score,
        active_accounts: parsed.active_accounts?.toString() || prev.active_accounts,
        total_outstanding: parsed.total_outstanding?.toString() || prev.total_outstanding,
        total_overdue: parsed.total_overdue?.toString() || prev.total_overdue,
        enquiry_count_30d: parsed.enquiry_count_30d?.toString() || prev.enquiry_count_30d,
        enquiry_count_90d: parsed.enquiry_count_90d?.toString() || prev.enquiry_count_90d,
        dpd_history: parsed.dpd_history || prev.dpd_history,
        remarks: parsed.remarks || prev.remarks,
        report_file_path: uploadData.path,
        name_on_report: parsed.name_on_report || prev.name_on_report,
        pan_on_report: parsed.pan_on_report || prev.pan_on_report,
        status: "success",
      }));

      setParsedSuccessfully(true);
      toast({
        title: "Report parsed successfully",
        description: `Credit score: ${parsed.credit_score || "Not found"}`,
      });

      return uploadData.path;
    } catch (error: any) {
      toast({
        title: "Error processing report",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
      setIsParsing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "credit_bureau",
        verification_source: formData.bureau_type,
        status: formData.status,
        request_data: { bureau_type: formData.bureau_type },
        response_data: {
          bureau_type: formData.bureau_type,
          credit_score: parseInt(formData.credit_score) || 0,
          active_accounts: parseInt(formData.active_accounts) || 0,
          total_outstanding: parseFloat(formData.total_outstanding) || 0,
          total_overdue: parseFloat(formData.total_overdue) || 0,
          enquiry_count_30d: parseInt(formData.enquiry_count_30d) || 0,
          enquiry_count_90d: parseInt(formData.enquiry_count_90d) || 0,
          dpd_history: formData.dpd_history,
          report_file_path: formData.report_file_path,
          name_on_report: formData.name_on_report,
          pan_on_report: formData.pan_on_report,
        },
        remarks: formData.remarks,
        verified_at: new Date().toISOString(),
      };

      if (existingVerification) {
        const { error } = await supabase
          .from("loan_verifications")
          .update(verificationData)
          .eq("id", existingVerification.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loan_verifications")
          .insert(verificationData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
      toast({ title: "Credit bureau verification saved successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save verification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeFile = () => {
    setUploadedFile(null);
    setParsedSuccessfully(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Credit Bureau Check</DialogTitle>
          <DialogDescription>
            Upload credit bureau report (CIBIL, Experian, Equifax, CRIF) for AI parsing or enter data manually
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Section */}
          <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <Label className="text-base font-medium">Upload Credit Bureau Report (AI Parsed)</Label>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Supports CIBIL, Experian, Equifax, and CRIF report formats (PDF, Image, HTML, Excel)
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.html,.htm,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="cibil-file-upload"
            />
            
            {!uploadedFile && !formData.report_file_path ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-primary/30 hover:bg-primary/10"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose CIBIL Report File
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-background rounded-md border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">
                      {uploadedFile ? uploadedFile.name : "CIBIL Report Uploaded"}
                    </span>
                    {parsedSuccessfully && (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Parsed
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {uploadedFile && !parsedSuccessfully && (
                  <Button
                    onClick={uploadAndParseFile}
                    disabled={isUploading || isParsing}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : isParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        AI Parsing Report...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Parse with AI
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Report Details {parsedSuccessfully && "(Auto-filled from report)"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bureau Type</Label>
              <Select value={formData.bureau_type} onValueChange={(value) => setFormData({ ...formData, bureau_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cibil">CIBIL</SelectItem>
                  <SelectItem value="experian">Experian</SelectItem>
                  <SelectItem value="equifax">Equifax</SelectItem>
                  <SelectItem value="crif">CRIF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credit Score</Label>
              <Input
                type="number"
                value={formData.credit_score}
                onChange={(e) => setFormData({ ...formData, credit_score: e.target.value })}
                placeholder="750"
                min="300"
                max="900"
              />
            </div>
          </div>

          {formData.name_on_report && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name on Report</Label>
                <Input
                  value={formData.name_on_report}
                  onChange={(e) => setFormData({ ...formData, name_on_report: e.target.value })}
                  placeholder="Name as per report"
                />
              </div>
              <div>
                <Label>PAN on Report</Label>
                <Input
                  value={formData.pan_on_report}
                  onChange={(e) => setFormData({ ...formData, pan_on_report: e.target.value })}
                  placeholder="PAN number"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Active Accounts</Label>
              <Input
                type="number"
                value={formData.active_accounts}
                onChange={(e) => setFormData({ ...formData, active_accounts: e.target.value })}
                placeholder="5"
              />
            </div>
            <div>
              <Label>Total Outstanding (₹)</Label>
              <Input
                type="number"
                value={formData.total_outstanding}
                onChange={(e) => setFormData({ ...formData, total_outstanding: e.target.value })}
                placeholder="500000"
              />
            </div>
          </div>

          <div>
            <Label>Total Overdue (₹)</Label>
            <Input
              type="number"
              value={formData.total_overdue}
              onChange={(e) => setFormData({ ...formData, total_overdue: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Enquiries (30 days)</Label>
              <Input
                type="number"
                value={formData.enquiry_count_30d}
                onChange={(e) => setFormData({ ...formData, enquiry_count_30d: e.target.value })}
                placeholder="2"
              />
            </div>
            <div>
              <Label>Enquiries (90 days)</Label>
              <Input
                type="number"
                value={formData.enquiry_count_90d}
                onChange={(e) => setFormData({ ...formData, enquiry_count_90d: e.target.value })}
                placeholder="4"
              />
            </div>
          </div>

          <div>
            <Label>DPD History Summary</Label>
            <Textarea
              value={formData.dpd_history}
              onChange={(e) => setFormData({ ...formData, dpd_history: e.target.value })}
              placeholder="e.g., No DPD in last 12 months, or 30+ DPD twice in last 24 months"
              rows={2}
            />
          </div>

          <div>
            <Label>Verification Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Additional observations from the credit report"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending || isUploading || isParsing}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Verification"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
