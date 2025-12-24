import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, Upload, Loader2, Shield, AlertCircle } from "lucide-react";
import { useLOSPermissions } from "@/hooks/useLOSPermissions";
import ProofUploadDialog from "./ProofUploadDialog";

interface DisbursementFormProps {
  applicationId: string;
}

export default function DisbursementForm({ applicationId }: DisbursementFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showProofUpload, setShowProofUpload] = useState(false);
  const { permissions } = useLOSPermissions();

  // Check if disbursement already exists
  const { data: existingDisbursement } = useQuery({
    queryKey: ["loan-disbursements", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_disbursements")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Get application details
  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("approved_amount")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Get sanction details
  const { data: sanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("id, processing_fee")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch OCR data from bank statement (read-only)
  const { data: bankStatementOCR } = useQuery({
    queryKey: ["bank-statement-ocr", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_documents")
        .select("ocr_data")
        .eq("loan_application_id", applicationId)
        .eq("document_type", "bank_statement")
        .not("ocr_data", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Check bank verification status
  const { data: bankVerification } = useQuery({
    queryKey: ["bank-verification", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_verifications")
        .select("status, response_data, verified_at")
        .eq("loan_application_id", applicationId)
        .eq("verification_type", "bank_account")
        .order("verified_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Extract bank details from OCR
  const ocrData = bankStatementOCR?.ocr_data as Record<string, any> | null;
  const bankDetails = {
    beneficiaryName: ocrData?.account_holder_name || "",
    accountNumber: ocrData?.account_number || "",
    ifscCode: ocrData?.ifsc_code || "",
    bankName: ocrData?.bank_name || "",
  };

  const isVerified = bankVerification?.status === "success";
  const hasBankDetails = bankDetails.accountNumber && bankDetails.ifscCode;

  const initiateDisbursementMutation = useMutation({
    mutationFn: async () => {
      if (!sanction) throw new Error("No sanction found");
      if (!application?.approved_amount) throw new Error("No approved amount found");
      if (!hasBankDetails) throw new Error("Bank details not available from OCR");

      const disbursementNumber = `DISB${Date.now()}`;
      const netDisbursementAmount = application.approved_amount - (sanction.processing_fee || 0);

      const { error } = await supabase.from("loan_disbursements").insert({
        loan_application_id: applicationId,
        sanction_id: sanction.id,
        disbursement_number: disbursementNumber,
        disbursement_amount: netDisbursementAmount,
        beneficiary_name: bankDetails.beneficiaryName,
        account_number: bankDetails.accountNumber,
        ifsc_code: bankDetails.ifscCode,
        bank_name: bankDetails.bankName,
        payment_mode: "neft",
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-disbursements", applicationId] });
      toast({ title: "Disbursement initiated", description: "Please upload UTR proof to complete." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!permissions.canInitiateDisbursement) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            You don't have permission to initiate disbursements
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // If disbursement already exists and is pending, show upload UTR option
  if (existingDisbursement && existingDisbursement.status === "pending") {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Complete Disbursement
            </CardTitle>
            <CardDescription>
              Disbursement initiated. Upload UTR proof to complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="text-sm text-muted-foreground">Disbursement Amount</div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(existingDisbursement.disbursement_amount)}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg bg-muted/50">
              <div>
                <div className="text-sm text-muted-foreground">Beneficiary</div>
                <div className="font-medium">{existingDisbursement.beneficiary_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Account Number</div>
                <div className="font-mono font-medium">{existingDisbursement.account_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">IFSC Code</div>
                <div className="font-mono font-medium">{existingDisbursement.ifsc_code}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Bank Name</div>
                <div className="font-medium">{existingDisbursement.bank_name}</div>
              </div>
            </div>

            <Button onClick={() => setShowProofUpload(true)} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Upload UTR Proof & Complete
            </Button>
          </CardContent>
        </Card>

        <ProofUploadDialog
          open={showProofUpload}
          onOpenChange={setShowProofUpload}
          disbursementId={existingDisbursement.id}
          applicationId={applicationId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["loan-disbursements", applicationId] });
            queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId] });
          }}
        />
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Initiate Disbursement
        </CardTitle>
        <CardDescription>
          Bank details auto-filled from bank statement OCR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Verification Status */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
          {isVerified ? (
            <>
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">Bank Account Verified</span>
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 ml-auto">Verified</Badge>
            </>
          ) : hasBankDetails ? (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700">Bank details from OCR (unverified)</span>
              <Badge variant="outline" className="ml-auto">Pending Verification</Badge>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">No bank details available</span>
            </>
          )}
        </div>

        {/* Disbursement Amount */}
        <div className="p-4 bg-primary/10 rounded-lg">
          <div className="text-sm text-muted-foreground">Disbursement Amount</div>
          <div className="text-2xl font-bold text-primary">
            {formatCurrency((application?.approved_amount || 0) - (sanction?.processing_fee || 0))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Approved: {formatCurrency(application?.approved_amount || 0)} - 
            Processing Fee: {formatCurrency(sanction?.processing_fee || 0)}
          </div>
        </div>

        {/* Bank Details (Read-only) */}
        {hasBankDetails && (
          <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg bg-muted/50">
            <div>
              <div className="text-sm text-muted-foreground">Beneficiary Name</div>
              <div className="font-medium">{bankDetails.beneficiaryName || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Account Number</div>
              <div className="font-mono font-medium">{bankDetails.accountNumber}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">IFSC Code</div>
              <div className="font-mono font-medium">{bankDetails.ifscCode}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Bank Name</div>
              <div className="font-medium">{bankDetails.bankName || "N/A"}</div>
            </div>
          </div>
        )}

        <Button
          onClick={() => initiateDisbursementMutation.mutate()}
          disabled={!hasBankDetails || initiateDisbursementMutation.isPending}
          className="w-full"
        >
          {initiateDisbursementMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Initiate Disbursement"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
