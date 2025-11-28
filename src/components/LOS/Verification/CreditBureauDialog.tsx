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
  });

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Credit Bureau Check</DialogTitle>
          <DialogDescription>
            Manual entry for credit bureau report data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
