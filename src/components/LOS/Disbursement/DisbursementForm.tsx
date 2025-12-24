import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle } from "lucide-react";

import { useLOSPermissions } from "@/hooks/useLOSPermissions";

interface DisbursementFormProps {
  applicationId: string;
}

export default function DisbursementForm({ applicationId }: DisbursementFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [paymentMode, setPaymentMode] = useState("neft");
  const [dataSource, setDataSource] = useState<"ocr" | "verified" | "manual" | null>(null);
  const { permissions } = useLOSPermissions();

  // Single source of truth: read approved_amount from loan_applications
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

  // PRIMARY: Fetch OCR data from bank statement
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

  // FALLBACK: Fetch verified bank account data
  const { data: bankVerification } = useQuery({
    queryKey: ["bank-verification", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_verifications")
        .select("request_data, response_data, status")
        .eq("loan_application_id", applicationId)
        .eq("verification_type", "bank_account")
        .eq("status", "success")
        .order("verified_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Auto-populate bank details: OCR (primary) → Verified (fallback)
  useEffect(() => {
    // Priority 1: OCR data from bank statement (PRIMARY)
    if (bankStatementOCR?.ocr_data) {
      const ocrData = bankStatementOCR.ocr_data as Record<string, any>;
      if (ocrData.account_holder_name) setBeneficiaryName(ocrData.account_holder_name);
      if (ocrData.account_number) setAccountNumber(ocrData.account_number);
      if (ocrData.ifsc_code) setIfscCode(ocrData.ifsc_code);
      if (ocrData.bank_name) setBankName(ocrData.bank_name);
      setDataSource("ocr");
      return;
    }

    // Priority 2: Verified bank account data (FALLBACK)
    if (bankVerification?.response_data) {
      const responseData = bankVerification.response_data as Record<string, any>;
      const requestData = bankVerification.request_data as Record<string, any>;
      if (responseData.account_holder_name) setBeneficiaryName(responseData.account_holder_name);
      if (requestData?.account_number) setAccountNumber(requestData.account_number);
      if (requestData?.ifsc_code) setIfscCode(requestData.ifsc_code);
      if (responseData.bank_name) setBankName(responseData.bank_name);
      setDataSource("verified");
      return;
    }

    setDataSource("manual");
  }, [bankStatementOCR, bankVerification]);

  const initiateDisbursementMutation = useMutation({
    mutationFn: async () => {
      if (!sanction) throw new Error("No sanction found");
      if (!application?.approved_amount) throw new Error("No approved amount found");

      const disbursementNumber = `DISB${Date.now()}`;
      // Calculate net disbursement from single source of truth
      const netDisbursementAmount = application.approved_amount - (sanction.processing_fee || 0);

      const { error } = await supabase.from("loan_disbursements").insert({
        loan_application_id: applicationId,
        sanction_id: sanction.id,
        disbursement_number: disbursementNumber,
        disbursement_amount: netDisbursementAmount,
        beneficiary_name: beneficiaryName,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        bank_name: bankName,
        payment_mode: paymentMode,
        status: "pending",
      });

      if (error) throw error;

      // Update application stage
      await supabase
        .from("loan_applications")
        .update({
          current_stage: "disbursed",
          status: "disbursed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-disbursements", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      toast({ title: "Disbursement initiated successfully" });
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

  const getDataSourceLabel = () => {
    switch (dataSource) {
      case "ocr":
        return "Auto-filled from bank statement (OCR)";
      case "verified":
        return "Auto-filled from verified bank account";
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Initiate Disbursement
        </CardTitle>
        <CardDescription>
          Enter bank details for loan disbursement
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data Source Indicator */}
        {dataSource && dataSource !== "manual" && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md text-sm">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span>{getDataSourceLabel()}</span>
          </div>
        )}

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

        <div className="space-y-2">
          <Label htmlFor="beneficiary-name">Beneficiary Name *</Label>
          <Input
            id="beneficiary-name"
            placeholder="Enter account holder name"
            value={beneficiaryName}
            onChange={(e) => setBeneficiaryName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-number">Account Number *</Label>
          <Input
            id="account-number"
            placeholder="Enter account number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ifsc-code">IFSC Code *</Label>
            <Input
              id="ifsc-code"
              placeholder="e.g., SBIN0001234"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-name">Bank Name *</Label>
            <Input
              id="bank-name"
              placeholder="Enter bank name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-mode">Payment Mode *</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger id="payment-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neft">NEFT</SelectItem>
              <SelectItem value="rtgs">RTGS</SelectItem>
              <SelectItem value="imps">IMPS</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => initiateDisbursementMutation.mutate()}
          disabled={
            !beneficiaryName ||
            !accountNumber ||
            !ifscCode ||
            !bankName ||
            initiateDisbursementMutation.isPending
          }
          className="w-full"
        >
          {initiateDisbursementMutation.isPending ? "Processing..." : "Initiate Disbursement"}
        </Button>
      </CardContent>
    </Card>
  );
}
