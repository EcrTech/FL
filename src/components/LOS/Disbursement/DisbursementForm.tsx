import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";

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
        <div className="p-4 bg-primary/10 rounded-lg">
          <div className="text-sm text-muted-foreground">Disbursement Amount</div>
          <div className="text-2xl font-bold text-primary">
            {formatCurrency((application?.approved_amount || 0) - (sanction.processing_fee || 0))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Approved: {formatCurrency(application?.approved_amount || 0)} - 
            Processing Fee: {formatCurrency(sanction.processing_fee || 0)}
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
