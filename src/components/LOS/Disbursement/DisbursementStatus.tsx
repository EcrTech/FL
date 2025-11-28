import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CheckCircle, XCircle, Clock, Building2 } from "lucide-react";
import { format } from "date-fns";

interface DisbursementStatusProps {
  applicationId: string;
}

export default function DisbursementStatus({ applicationId }: DisbursementStatusProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [utrNumber, setUtrNumber] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  const { data: disbursement } = useQuery({
    queryKey: ["loan-disbursements", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_disbursements")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: "completed" | "failed") => {
      if (!disbursement) throw new Error("No disbursement found");

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "completed") {
        updateData.utr_number = utrNumber;
        updateData.disbursement_date = new Date().toISOString();
      } else if (status === "failed") {
        updateData.failure_reason = failureReason;
      }

      const { error } = await supabase
        .from("loan_disbursements")
        .update(updateData)
        .eq("id", disbursement.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-disbursements", applicationId] });
      toast({ title: "Disbursement status updated" });
      setShowUpdateForm(false);
      setUtrNumber("");
      setFailureReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!disbursement) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statusConfig = {
    pending: { icon: Clock, color: "bg-yellow-500", label: "Pending" },
    completed: { icon: CheckCircle, color: "bg-green-500", label: "Completed" },
    failed: { icon: XCircle, color: "bg-red-500", label: "Failed" },
  };

  const config = statusConfig[disbursement.status as keyof typeof statusConfig];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Disbursement Status
            </CardTitle>
            <Badge className={config.color}>{config.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Disbursement Number</div>
              <div className="font-medium font-mono">{disbursement.disbursement_number}</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(disbursement.disbursement_amount)}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Payment Mode</div>
              <div className="font-medium uppercase">{disbursement.payment_mode || "N/A"}</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Bank Details</h4>
            <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Beneficiary Name</div>
                <div className="font-medium">{disbursement.beneficiary_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Account Number</div>
                <div className="font-medium font-mono">{disbursement.account_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">IFSC Code</div>
                <div className="font-medium font-mono">{disbursement.ifsc_code}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Bank Name</div>
                <div className="font-medium">{disbursement.bank_name}</div>
              </div>
            </div>
          </div>

          {disbursement.utr_number && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-muted-foreground">UTR Number</div>
              <div className="font-medium font-mono">{disbursement.utr_number}</div>
              {disbursement.disbursement_date && (
                <div className="text-xs text-muted-foreground mt-1">
                  Completed on {format(new Date(disbursement.disbursement_date), "MMM dd, yyyy")}
                </div>
              )}
            </div>
          )}

          {disbursement.failure_reason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-muted-foreground">Failure Reason</div>
              <div className="text-sm">{disbursement.failure_reason}</div>
            </div>
          )}

          {disbursement.status === "pending" && !showUpdateForm && (
            <div className="flex gap-4">
              <Button onClick={() => setShowUpdateForm(true)}>
                Update Status
              </Button>
            </div>
          )}

          {showUpdateForm && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium">Update Disbursement Status</h4>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="utr">UTR Number (for completion)</Label>
                  <Input
                    id="utr"
                    placeholder="Enter UTR/reference number"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="failure">Failure Reason (if failed)</Label>
                  <Textarea
                    id="failure"
                    placeholder="Enter reason for failure"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="default"
                    onClick={() => updateStatusMutation.mutate("completed")}
                    disabled={!utrNumber || updateStatusMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Completed
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateStatusMutation.mutate("failed")}
                    disabled={!failureReason || updateStatusMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Mark Failed
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowUpdateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
