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

interface BankAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function BankAnalysisDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: BankAnalysisDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    statement_period_from: existingVerification?.response_data?.statement_period_from || "",
    statement_period_to: existingVerification?.response_data?.statement_period_to || "",
    average_monthly_balance: existingVerification?.response_data?.average_monthly_balance || "",
    average_salary_amount: existingVerification?.response_data?.average_salary_amount || "",
    bounce_count: existingVerification?.response_data?.bounce_count || "0",
    total_emi_debits: existingVerification?.response_data?.total_emi_debits || "",
    foir_calculated: existingVerification?.response_data?.foir_calculated || "",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "bank_statement",
        verification_source: "manual",
        status: formData.status,
        request_data: {
          statement_period_from: formData.statement_period_from,
          statement_period_to: formData.statement_period_to,
        },
        response_data: {
          statement_period_from: formData.statement_period_from,
          statement_period_to: formData.statement_period_to,
          average_monthly_balance: parseFloat(formData.average_monthly_balance) || 0,
          average_salary_amount: parseFloat(formData.average_salary_amount) || 0,
          bounce_count: parseInt(formData.bounce_count) || 0,
          total_emi_debits: parseFloat(formData.total_emi_debits) || 0,
          foir_calculated: parseFloat(formData.foir_calculated) || 0,
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
      toast({ title: "Bank analysis saved successfully" });
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
          <DialogTitle>Bank Statement Analysis</DialogTitle>
          <DialogDescription>
            Manual entry for bank statement analysis results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Statement Period From</Label>
              <Input
                type="date"
                value={formData.statement_period_from}
                onChange={(e) => setFormData({ ...formData, statement_period_from: e.target.value })}
              />
            </div>
            <div>
              <Label>Statement Period To</Label>
              <Input
                type="date"
                value={formData.statement_period_to}
                onChange={(e) => setFormData({ ...formData, statement_period_to: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Average Monthly Balance (₹)</Label>
            <Input
              type="number"
              value={formData.average_monthly_balance}
              onChange={(e) => setFormData({ ...formData, average_monthly_balance: e.target.value })}
              placeholder="50000"
            />
          </div>

          <div>
            <Label>Average Salary Amount (₹)</Label>
            <Input
              type="number"
              value={formData.average_salary_amount}
              onChange={(e) => setFormData({ ...formData, average_salary_amount: e.target.value })}
              placeholder="75000"
            />
          </div>

          <div>
            <Label>Total EMI Debits (₹)</Label>
            <Input
              type="number"
              value={formData.total_emi_debits}
              onChange={(e) => setFormData({ ...formData, total_emi_debits: e.target.value })}
              placeholder="25000"
            />
          </div>

          <div>
            <Label>Bounce Count</Label>
            <Input
              type="number"
              value={formData.bounce_count}
              onChange={(e) => setFormData({ ...formData, bounce_count: e.target.value })}
              placeholder="0"
            />
          </div>

          <div>
            <Label>FOIR Calculated (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.foir_calculated}
              onChange={(e) => setFormData({ ...formData, foir_calculated: e.target.value })}
              placeholder="45.5"
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
            {saveMutation.isPending ? "Saving..." : "Save Analysis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
