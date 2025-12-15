import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle } from "lucide-react";

import { useLOSPermissions } from "@/hooks/useLOSPermissions";

interface ApprovalActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  action: "approve" | "reject";
  orgId: string;
  userId: string;
}

export default function ApprovalActionDialog({
  open,
  onOpenChange,
  applicationId,
  action,
  orgId,
  userId,
}: ApprovalActionDialogProps) {
  const [comments, setComments] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useLOSPermissions();

  const actionMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();

      // Create approval record
      const { error: approvalError } = await supabase
        .from("loan_approvals")
        .insert({
          loan_application_id: applicationId,
          org_id: orgId,
          approver_id: userId,
          approver_role: "credit_manager",
          approval_level: "final",
          approval_status: action === "approve" ? "approved" : "rejected",
          approved_amount: action === "approve" && approvedAmount ? parseFloat(approvedAmount) : null,
          comments,
        });

      if (approvalError) throw approvalError;

      // Update application stage
      const newStage = action === "approve" ? "sanctioned" : "rejected";
      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          current_stage: newStage,
          updated_at: now,
        })
        .eq("id", applicationId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-approvals", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });

      toast({
        title: action === "approve" ? "Application Approved" : "Application Rejected",
        description: `The application has been ${action}d successfully.`,
      });

      onOpenChange(false);
      setComments("");
      setApprovedAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!permissions.canApproveLoans && action === "approve") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permission Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You don't have permission to approve loan applications.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  if (!permissions.canRejectLoans && action === "reject") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permission Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You don't have permission to reject loan applications.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "approve" ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Approve Application
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Reject Application
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? "Provide approval details and approved loan amount."
              : "Provide reason for rejection."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {action === "approve" && (
            <div className="space-y-2">
              <Label htmlFor="approved-amount">Approved Loan Amount *</Label>
              <Input
                id="approved-amount"
                type="number"
                placeholder="Enter approved amount"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="comments">
              {action === "approve" ? "Comments *" : "Rejection Reason *"}
            </Label>
            <Textarea
              id="comments"
              placeholder={
                action === "approve"
                  ? "Add approval comments (required)..."
                  : "Explain why the application is being rejected..."
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={action === "approve" ? "default" : "destructive"}
            onClick={() => actionMutation.mutate()}
            disabled={
              actionMutation.isPending ||
              (action === "approve" && (!approvedAmount || !comments)) ||
              (action === "reject" && !comments)
            }
          >
            {actionMutation.isPending
              ? "Processing..."
              : action === "approve"
              ? "Approve"
              : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
