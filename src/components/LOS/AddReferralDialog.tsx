import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddReferralDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  applicantId: string;
  orgId: string;
}

export function AddReferralDialog({
  open,
  onClose,
  applicationId,
  applicantId,
  orgId,
}: AddReferralDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    referral_type: "personal" as "professional" | "personal" | "family" | "other",
    name: "",
    mobile: "",
    email: "",
    address: "",
    relationship: "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loan_referrals").insert({
        loan_application_id: applicationId,
        applicant_id: applicantId,
        org_id: orgId,
        referral_type: formData.referral_type,
        name: formData.name,
        mobile: formData.mobile || null,
        email: formData.email || null,
        address: formData.address || null,
        relationship: formData.relationship || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referral added successfully");
      queryClient.invalidateQueries({ queryKey: ["loan-referrals", applicationId] });
      onClose();
      setFormData({
        referral_type: "personal",
        name: "",
        mobile: "",
        email: "",
        address: "",
        relationship: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add referral");
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Referral</DialogTitle>
          <DialogDescription>
            Add an additional referral for this loan application
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Referral Type</Label>
            <Select
              value={formData.referral_type}
              onValueChange={(value: any) => setFormData({ ...formData, referral_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter referral name"
            />
          </div>

          <div>
            <Label>Relationship</Label>
            <Input
              value={formData.relationship}
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
              placeholder="e.g., Colleague, Friend, Relative"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mobile</Label>
              <Input
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="10-digit mobile"
                maxLength={10}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email address"
              />
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter address"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Referral"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
