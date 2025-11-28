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

interface AadhaarVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function AadhaarVerificationDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: AadhaarVerificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    aadhaar_last4: existingVerification?.request_data?.aadhaar_last4 || "",
    verified_address: existingVerification?.response_data?.verified_address || "",
    address_match_result: existingVerification?.response_data?.address_match_result || "exact",
    aadhaar_status: existingVerification?.response_data?.aadhaar_status || "valid",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "aadhaar",
        verification_source: "uidai",
        status: formData.status,
        request_data: { aadhaar_last4: formData.aadhaar_last4 },
        response_data: {
          verified_address: formData.verified_address,
          address_match_result: formData.address_match_result,
          aadhaar_status: formData.aadhaar_status,
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
      toast({ title: "Aadhaar verification saved successfully" });
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
          <DialogTitle>Aadhaar Verification</DialogTitle>
          <DialogDescription>
            Manual entry for Aadhaar verification results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Aadhaar Last 4 Digits</Label>
            <Input
              value={formData.aadhaar_last4}
              onChange={(e) => setFormData({ ...formData, aadhaar_last4: e.target.value })}
              placeholder="XXXX"
              maxLength={4}
            />
          </div>

          <div>
            <Label>Verified Address</Label>
            <Textarea
              value={formData.verified_address}
              onChange={(e) => setFormData({ ...formData, verified_address: e.target.value })}
              placeholder="Address as per Aadhaar"
              rows={3}
            />
          </div>

          <div>
            <Label>Address Match Result</Label>
            <Select value={formData.address_match_result} onValueChange={(value) => setFormData({ ...formData, address_match_result: value })}>
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
            <Label>Aadhaar Status</Label>
            <Select value={formData.aadhaar_status} onValueChange={(value) => setFormData({ ...formData, aadhaar_status: value })}>
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
