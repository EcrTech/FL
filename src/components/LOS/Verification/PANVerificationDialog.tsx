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

interface PANVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function PANVerificationDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: PANVerificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    pan_number: existingVerification?.request_data?.pan_number || applicant?.pan_number || "",
    name_on_pan: existingVerification?.response_data?.name_on_pan || "",
    pan_status: existingVerification?.response_data?.pan_status || "valid",
    name_match_result: existingVerification?.response_data?.name_match_result || "exact",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "pan",
        verification_source: "nsdl",
        status: formData.status,
        request_data: { pan_number: formData.pan_number },
        response_data: {
          name_on_pan: formData.name_on_pan,
          pan_status: formData.pan_status,
          name_match_result: formData.name_match_result,
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
      toast({ title: "PAN verification saved successfully" });
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
          <DialogTitle>PAN Verification</DialogTitle>
          <DialogDescription>
            Manual entry for PAN card verification results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>PAN Number</Label>
            <Input
              value={formData.pan_number}
              onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
              placeholder="ABCDE1234F"
              maxLength={10}
            />
          </div>

          <div>
            <Label>Name on PAN</Label>
            <Input
              value={formData.name_on_pan}
              onChange={(e) => setFormData({ ...formData, name_on_pan: e.target.value })}
              placeholder="Full name as per PAN"
            />
          </div>

          <div>
            <Label>PAN Status</Label>
            <Select value={formData.pan_status} onValueChange={(value) => setFormData({ ...formData, pan_status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
                <SelectItem value="not_found">Not Found</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Name Match Result</Label>
            <Select value={formData.name_match_result} onValueChange={(value) => setFormData({ ...formData, name_match_result: value })}>
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
