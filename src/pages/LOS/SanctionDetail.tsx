import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { format } from "date-fns";
import DisbursementDashboard from "@/components/LOS/Disbursement/DisbursementDashboard";
import SanctionGenerator from "@/components/LOS/Sanction/SanctionGenerator";
import { useOrgContext } from "@/hooks/useOrgContext";
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted",
  in_progress: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  disbursed: "bg-purple-500",
};

export default function SanctionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orgId } = useOrgContext();

  const { data: application, isLoading } = useQuery({
    queryKey: ["sanction-application", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants(first_name, last_name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading sanction details..." />
      </DashboardLayout>
    );
  }

  if (!application) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold">Application not found</h3>
        </div>
      </DashboardLayout>
    );
  }

  const primaryApplicant = application.loan_applicants?.[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/los/sanctions")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  Sanction - {application.application_number}
                </h1>
                <Badge className={STATUS_COLORS[application.status]}>
                  {application.status.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {primaryApplicant && `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`}
                {" • "}
                {formatCurrency(application.approved_amount || application.requested_amount)}
                {" • "}
                Created {format(new Date(application.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
          <SanctionGenerator applicationId={application.id} orgId={orgId || ""} />
        </div>

        {/* Sanction Content - Only Loan Summary & Documents */}
        <DisbursementDashboard applicationId={application.id} />
      </div>
    </DashboardLayout>
  );
}
