import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Eye, FileText } from "lucide-react";
import { format } from "date-fns";

interface ApprovalQueueProps {
  orgId: string;
  userId: string;
}

const STAGE_LABELS: Record<string, string> = {
  application_login: "Application Login",
  document_collection: "Document Collection",
  field_verification: "Field Verification",
  credit_assessment: "Credit Assessment",
  approval_pending: "Approval Pending",
  sanctioned: "Sanctioned",
  rejected: "Rejected",
  disbursement_pending: "Disbursement Pending",
  disbursed: "Disbursed",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STAGE_COLORS: Record<string, string> = {
  application_login: "bg-muted text-muted-foreground",
  document_collection: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  field_verification: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  credit_assessment: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  approval_pending: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  sanctioned: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  disbursement_pending: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  disbursed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export default function ApprovalQueue({ orgId, userId }: ApprovalQueueProps) {
  const navigate = useNavigate();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["approval-queue", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants(*),
          assigned_profile:profiles!assigned_to(first_name, last_name)
        `)
        .eq("org_id", orgId)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return <LoadingState message="Loading applications..." />;
  }

  const getApplicantName = (app: any) => {
    const applicant = app.loan_applicants?.[0];
    if (!applicant) return "N/A";
    return `${applicant.first_name} ${applicant.last_name || ""}`.trim();
  };

  const getAssigneeName = (app: any) => {
    if (!app.assigned_profile) return "Unassigned";
    return `${app.assigned_profile.first_name} ${app.assigned_profile.last_name || ""}`.trim();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Approval Queue</h2>
        <p className="text-muted-foreground">Review and process in-progress loan applications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            In-Progress Applications
          </CardTitle>
          <CardDescription>
            {applications?.length || 0} application(s) requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!applications || applications.length === 0 ? (
            <EmptyState
              title="No applications in queue"
              message="There are no in-progress applications at this time."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application #</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono font-medium">
                      {app.application_number}
                    </TableCell>
                    <TableCell>{getApplicantName(app)}</TableCell>
                    <TableCell>{formatCurrency(app.requested_amount)}</TableCell>
                    <TableCell>
                      <Badge className={STAGE_COLORS[app.current_stage] || "bg-muted"}>
                        {STAGE_LABELS[app.current_stage] || app.current_stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(app.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>{getAssigneeName(app)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/los/applications/${app.id}?mode=review`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
