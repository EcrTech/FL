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

interface EmploymentVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function EmploymentVerificationDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: EmploymentVerificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    uan_number: existingVerification?.request_data?.uan_number || "",
    employer_name: existingVerification?.response_data?.employer_name || "",
    membership_status: existingVerification?.response_data?.membership_status || "active",
    employer_match: existingVerification?.response_data?.employer_match || "exact",
    last_contribution_date: existingVerification?.response_data?.last_contribution_date || "",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "employment",
        verification_source: "epfo",
        status: formData.status,
        request_data: { uan_number: formData.uan_number },
        response_data: {
          employer_name: formData.employer_name,
          membership_status: formData.membership_status,
          employer_match: formData.employer_match,
          last_contribution_date: formData.last_contribution_date,
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
      toast({ title: "Employment verification saved successfully" });
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
          <DialogTitle>Employment Verification</DialogTitle>
          <DialogDescription>
            Manual entry for EPFO employment verification results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>UAN Number</Label>
            <Input
              value={formData.uan_number}
              onChange={(e) => setFormData({ ...formData, uan_number: e.target.value })}
              placeholder="Universal Account Number"
            />
          </div>

          <div>
            <Label>Employer Name (as per EPFO)</Label>
            <Input
              value={formData.employer_name}
              onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
              placeholder="Employer name"
            />
          </div>

          <div>
            <Label>Membership Status</Label>
            <Select value={formData.membership_status} onValueChange={(value) => setFormData({ ...formData, membership_status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="not_found">Not Found</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Employer Match Result</Label>
            <Select value={formData.employer_match} onValueChange={(value) => setFormData({ ...formData, employer_match: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact Match</SelectItem>
                <SelectItem value="partial">Partial Match</SelectItem>
                <SelectItem value="no_match">No Match</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Last Contribution Date</Label>
            <Input
              type="date"
              value={formData.last_contribution_date}
              onChange={(e) => setFormData({ ...formData, last_contribution_date: e.target.value })}
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
            {saveMutation.isPending ? "Saving..." : "Save Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
