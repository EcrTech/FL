import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, FileText, CheckCircle, Calculator, ThumbsUp, FileCheck, DollarSign, XCircle } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { format } from "date-fns";
import DocumentUpload from "@/components/LOS/DocumentUpload";
import VerificationDashboard from "@/components/LOS/VerificationDashboard";
import AssessmentDashboard from "@/components/LOS/Assessment/AssessmentDashboard";
import ApprovalActionDialog from "@/components/LOS/Approval/ApprovalActionDialog";
import ApprovalHistory from "@/components/LOS/Approval/ApprovalHistory";
import SanctionDashboard from "@/components/LOS/Sanction/SanctionDashboard";

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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted",
  in_progress: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  disbursed: "bg-purple-500",
};

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);

  const { data: userData } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const response = await supabase.auth.getUser();
      return response.data;
    },
  });
  
  const user = userData?.user;

  const { data: application, isLoading } = useQuery({
    queryKey: ["loan-application", id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          contacts(first_name, last_name, email, phone),
          assigned_profile:profiles!assigned_to(first_name, last_name),
          loan_applicants(*),
          loan_employment_details(*)
        `)
        .eq("id", id)
        .eq("org_id", orgId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!orgId,
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
        <LoadingState message="Loading application..." />
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
  const employment = Array.isArray(application.loan_employment_details) 
    ? application.loan_employment_details[0] 
    : application.loan_employment_details;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/los/applications")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">
                  {application.application_number}
                </h1>
                <Badge className={STATUS_COLORS[application.status]}>
                  {application.status.replace("_", " ").toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {STAGE_LABELS[application.current_stage] || application.current_stage}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                Created {format(new Date(application.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Requested Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(application.requested_amount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tenure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{application.tenure_months} months</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Applicant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {primaryApplicant
                  ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`
                  : "N/A"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Assigned To</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {(application as any).assigned_profile
                  ? `${(application as any).assigned_profile.first_name} ${(application as any).assigned_profile.last_name || ""}`
                  : "Unassigned"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="application" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="application">
              <User className="h-4 w-4 mr-2" />
              Application
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="verification">
              <CheckCircle className="h-4 w-4 mr-2" />
              Verification
            </TabsTrigger>
            <TabsTrigger value="assessment">
              <Calculator className="h-4 w-4 mr-2" />
              Assessment
            </TabsTrigger>
            <TabsTrigger value="approval">
              <ThumbsUp className="h-4 w-4 mr-2" />
              Approval
            </TabsTrigger>
            <TabsTrigger value="sanction">
              <FileCheck className="h-4 w-4 mr-2" />
              Sanction
            </TabsTrigger>
            <TabsTrigger value="disbursement">
              <DollarSign className="h-4 w-4 mr-2" />
              Disbursement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="application" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Applicant Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {primaryApplicant && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                      <p className="text-sm">
                        {primaryApplicant.first_name} {primaryApplicant.middle_name || ""}{" "}
                        {primaryApplicant.last_name || ""}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                      <p className="text-sm">
                        {primaryApplicant.dob
                          ? format(new Date(primaryApplicant.dob as string), "MMM dd, yyyy")
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Gender</label>
                      <p className="text-sm">{(primaryApplicant.gender as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Marital Status</label>
                      <p className="text-sm">{(primaryApplicant.marital_status as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">PAN Number</label>
                      <p className="text-sm font-mono">{(primaryApplicant.pan_number as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Mobile</label>
                      <p className="text-sm">{(primaryApplicant.mobile as string) || "N/A"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Current Address</label>
                      <p className="text-sm">{(primaryApplicant.current_address as string) || "N/A"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {employment && (
              <Card>
                <CardHeader>
                  <CardTitle>Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Employer Name</label>
                      <p className="text-sm">{(employment.employer_name as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Designation</label>
                      <p className="text-sm">{(employment.designation as string) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date of Joining</label>
                      <p className="text-sm">
                        {employment.date_of_joining
                          ? format(new Date(employment.date_of_joining as string), "MMM dd, yyyy")
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Experience</label>
                      <p className="text-sm">{(employment.total_experience as number) || "N/A"} years</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Gross Monthly Salary</label>
                      <p className="text-sm">
                        {employment.gross_monthly_salary
                          ? formatCurrency(employment.gross_monthly_salary as number)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Net Monthly Salary</label>
                      <p className="text-sm">
                        {employment.net_monthly_salary
                          ? formatCurrency(employment.net_monthly_salary as number)
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="documents">
            <DocumentUpload applicationId={application.id} orgId={orgId} />
          </TabsContent>

          <TabsContent value="verification">
            <VerificationDashboard applicationId={application.id} orgId={orgId} />
          </TabsContent>

          <TabsContent value="assessment">
            <AssessmentDashboard applicationId={application.id} orgId={orgId} />
          </TabsContent>

          <TabsContent value="approval" className="space-y-6">
            {application.current_stage === "approval_pending" && (
              <Card>
                <CardHeader>
                  <CardTitle>Approval Actions</CardTitle>
                  <CardDescription>
                    Review and take action on this loan application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button
                      variant="default"
                      onClick={() => setApprovalAction("approve")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Application
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setApprovalAction("reject")}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Application
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <ApprovalHistory applicationId={id!} />
          </TabsContent>

          <TabsContent value="sanction">
            <SanctionDashboard applicationId={application.id} orgId={orgId} />
          </TabsContent>

          <TabsContent value="disbursement">
            <Card>
              <CardHeader>
                <CardTitle>Disbursement</CardTitle>
                <CardDescription>Coming soon - Disbursement processing</CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {approvalAction && orgId && user && (
        <ApprovalActionDialog
          open={!!approvalAction}
          onOpenChange={() => setApprovalAction(null)}
          applicationId={id!}
          action={approvalAction}
          orgId={orgId}
          userId={user.id}
        />
      )}
    </DashboardLayout>
  );
}
