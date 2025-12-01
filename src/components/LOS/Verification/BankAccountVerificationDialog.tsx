import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface BankAccountVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function BankAccountVerificationDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: BankAccountVerificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    account_number: existingVerification?.request_data?.account_number || "",
    ifsc_code: existingVerification?.request_data?.ifsc_code || "",
    account_holder_name: existingVerification?.response_data?.account_holder_name || "",
    bank_name: existingVerification?.response_data?.bank_name || "",
    branch_name: existingVerification?.response_data?.branch_name || "",
    verify_type: "pennyless",
    status: existingVerification?.status || "pending",
    remarks: existingVerification?.remarks || "",
  });

  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Authenticate with Sandbox
  const authMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sandbox-authenticate');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      toast({ title: "Authenticated successfully" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error.message || "Failed to authenticate with verification service",
      });
    },
  });

  // Verify Bank Account via Sandbox API
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not authenticated. Please authenticate first.");
      }
      if (!formData.account_number || !formData.ifsc_code) {
        throw new Error("Please enter account number and IFSC code");
      }

      const { data, error } = await supabase.functions.invoke('sandbox-bank-verify', {
        body: {
          accountNumber: formData.account_number,
          ifscCode: formData.ifsc_code,
          applicationId,
          orgId,
          accessToken,
          verifyType: formData.verify_type,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Bank Account Verified",
        description: "Bank account details verified successfully",
      });
      // Update form with verified data
      setFormData(prev => ({
        ...prev,
        account_holder_name: data.data.account_holder_name || prev.account_holder_name,
        bank_name: data.data.bank_name || prev.bank_name,
        branch_name: data.data.branch_name || prev.branch_name,
        status: data.verification_status,
      }));
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Failed to verify bank account",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "bank_account",
        verification_source: "sandbox",
        status: formData.status,
        request_data: {
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          verify_type: formData.verify_type,
        },
        response_data: {
          account_holder_name: formData.account_holder_name,
          bank_name: formData.bank_name,
          branch_name: formData.branch_name,
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
      toast({ title: "Bank account verification saved successfully" });
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bank Account Verification</DialogTitle>
          <DialogDescription>
            Verify bank account details via Sandbox API
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Authentication and Verification Actions */}
          <div className="space-y-2">
            {!accessToken ? (
              <Button
                onClick={() => authMutation.mutate()}
                disabled={authMutation.isPending}
                variant="outline"
                className="w-full"
              >
                {authMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Authenticate with Sandbox
              </Button>
            ) : (
              <>
                <div>
                  <Label>Verification Type</Label>
                  <Select 
                    value={formData.verify_type} 
                    onValueChange={(value) => setFormData({ ...formData, verify_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pennyless">Penny-less Verification</SelectItem>
                      <SelectItem value="pennydrop">Penny Drop Verification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Account Number</Label>
                  <Input
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="Enter account number"
                  />
                </div>

                <div>
                  <Label>IFSC Code</Label>
                  <Input
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                    placeholder="Enter IFSC code"
                  />
                </div>

                <Button
                  onClick={() => verifyMutation.mutate()}
                  disabled={!formData.account_number || !formData.ifsc_code || verifyMutation.isPending}
                  variant="default"
                  className="w-full"
                >
                  {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify via API
                </Button>
              </>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Verification Results</h4>
          </div>

          <div>
            <Label>Account Holder Name</Label>
            <Input
              value={formData.account_holder_name}
              onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
              placeholder="As per bank records"
            />
          </div>

          <div>
            <Label>Bank Name</Label>
            <Input
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder="Bank name"
            />
          </div>

          <div>
            <Label>Branch Name</Label>
            <Input
              value={formData.branch_name}
              onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
              placeholder="Branch name"
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
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Additional notes or observations"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
