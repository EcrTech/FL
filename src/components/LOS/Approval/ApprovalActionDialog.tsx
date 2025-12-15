import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useLOSPermissions();

  // Fetch eligibility data - this is the source of truth for approved amount
  const { data: eligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["loan-eligibility", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_eligibility")
        .select("eligible_loan_amount, recommended_tenure_days, recommended_interest_rate")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && action === "approve",
  });

  const actionMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      
      // For approval, use eligibility data as single source of truth
      const approvedAmount = action === "approve" && eligibility 
        ? eligibility.eligible_loan_amount 
        : null;
      const tenureDays = action === "approve" && eligibility 
        ? eligibility.recommended_tenure_days 
        : null;
      const interestRate = action === "approve" && eligibility 
        ? eligibility.recommended_interest_rate 
        : null;

      // Create approval record (audit trail only)
      const { error: approvalError } = await supabase
        .from("loan_approvals")
        .insert({
          loan_application_id: applicationId,
          org_id: orgId,
          approver_id: userId,
          approver_role: "credit_manager",
          approval_level: "final",
          approval_status: action === "approve" ? "approved" : "rejected",
          approved_amount: approvedAmount,
          comments,
        });

      if (approvalError) throw approvalError;

      // Update application - use eligibility data for approved values
      const newStage = action === "approve" ? "sanctioned" : "rejected";
      const newStatus = action === "approve" ? "approved" : "rejected";
      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          current_stage: newStage,
          status: newStatus,
          approved_amount: approvedAmount,
          tenure_days: tenureDays,
          interest_rate: interestRate,
          approved_by: action === "approve" ? userId : null,
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
              ? "Review and confirm the approved loan details from eligibility assessment."
              : "Provide reason for rejection."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {action === "approve" && (
            <>
              {eligibilityLoading ? (
                <p className="text-muted-foreground text-sm">Loading eligibility data...</p>
              ) : eligibility ? (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Eligible Amount:</span>
                    <span className="font-semibold">₹{eligibility.eligible_loan_amount?.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tenure:</span>
                    <span className="font-medium">{eligibility.recommended_tenure_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest Rate:</span>
                    <span className="font-medium">{eligibility.recommended_interest_rate}%</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm text-yellow-700">No eligibility assessment found. Please complete eligibility calculation first.</p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="comments">
              {action === "approve" ? "Comments (Optional)" : "Rejection Reason *"}
            </Label>
            <Textarea
              id="comments"
              placeholder={
                action === "approve"
                  ? "Add any additional comments..."
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
              (action === "approve" && !eligibility) ||
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
