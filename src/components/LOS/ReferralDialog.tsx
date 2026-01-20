import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface LoanReferral {
  id: string;
  referral_type: "professional" | "personal" | "family" | "other";
  name: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
  relationship: string | null;
}

interface ReferralDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  applicantId: string;
  orgId: string;
  referral?: LoanReferral; // If provided, dialog is in edit mode
}

export function ReferralDialog({
  open,
  onClose,
  applicationId,
  applicantId,
  orgId,
  referral,
}: ReferralDialogProps) {
  const queryClient = useQueryClient();
  const isEditMode = !!referral;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    referral_type: "personal" as "professional" | "personal" | "family" | "other",
    name: "",
    mobile: "",
    email: "",
    address: "",
    relationship: "",
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (referral) {
      setFormData({
        referral_type: referral.referral_type,
        name: referral.name,
        mobile: referral.mobile || "",
        email: referral.email || "",
        address: referral.address || "",
        relationship: referral.relationship || "",
      });
    } else {
      setFormData({
        referral_type: "personal",
        name: "",
        mobile: "",
        email: "",
        address: "",
        relationship: "",
      });
    }
  }, [referral, open]);

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
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add referral");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!referral) throw new Error("No referral to update");
      const { error } = await supabase
        .from("loan_referrals")
        .update({
          referral_type: formData.referral_type,
          name: formData.name,
          mobile: formData.mobile || null,
          email: formData.email || null,
          address: formData.address || null,
          relationship: formData.relationship || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", referral.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referral updated successfully");
      queryClient.invalidateQueries({ queryKey: ["loan-referrals", applicationId] });
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update referral");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!referral) throw new Error("No referral to delete");
      const { error } = await supabase
        .from("loan_referrals")
        .delete()
        .eq("id", referral.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referral deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["loan-referrals", applicationId] });
      setShowDeleteConfirm(false);
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete referral");
    },
  });

  const handleClose = () => {
    setFormData({
      referral_type: "personal",
      name: "",
      mobile: "",
      email: "",
      address: "",
      relationship: "",
    });
    onClose();
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (isEditMode) {
      updateMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Referral" : "Add Referral"}</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Update the referral information" : "Add an additional referral for this loan application"}
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

          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {isEditMode && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending || deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditMode ? "Saving..." : "Adding..."}
                  </>
                ) : (
                  isEditMode ? "Save Changes" : "Add Referral"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Referral</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this referral? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Keep backward compatibility with old name
export { ReferralDialog as AddReferralDialog };
