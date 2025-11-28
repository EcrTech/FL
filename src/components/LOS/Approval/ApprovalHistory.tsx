import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, Clock, MessageSquare } from "lucide-react";

interface ApprovalHistoryProps {
  applicationId: string;
}

export default function ApprovalHistory({ applicationId }: ApprovalHistoryProps) {
  const { data: approvals, isLoading } = useQuery({
    queryKey: ["loan-approvals", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_approvals")
        .select(`
          *,
          profiles:approver_id (
            first_name,
            last_name
          )
        `)
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading approval history...</div>
        </CardContent>
      </Card>
    );
  }

  if (!approvals || approvals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No approval actions yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {approvals.map((approval: any) => (
            <div
              key={approval.id}
              className="flex gap-4 p-4 border rounded-lg"
            >
              <div className="flex-shrink-0">
                {approval.approval_status === "approved" ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : approval.approval_status === "rejected" ? (
                  <XCircle className="h-6 w-6 text-red-600" />
                ) : (
                  <Clock className="h-6 w-6 text-yellow-600" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {approval.profiles?.first_name} {approval.profiles?.last_name}
                  </div>
                  <Badge
                    variant={
                      approval.approval_status === "approved"
                        ? "default"
                        : approval.approval_status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {approval.approval_status}
                  </Badge>
                </div>

                {approval.approved_amount && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Approved Amount: </span>
                    <span className="font-medium">
                      ₹{approval.approved_amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}

                {approval.comments && (
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <p>{approval.comments}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
