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
import { ArrowLeft, User, FileText, Calculator, ThumbsUp, FileCheck, DollarSign, XCircle, CreditCard, CheckCircle } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { format } from "date-fns";
import DocumentUpload from "@/components/LOS/DocumentUpload";
import DocumentDataVerification from "@/components/LOS/DocumentDataVerification";
import IncomeSummary from "@/components/LOS/IncomeSummary";
import AssessmentDashboard from "@/components/LOS/Assessment/AssessmentDashboard";
import ApprovalActionDialog from "@/components/LOS/Approval/ApprovalActionDialog";
import ApprovalHistory from "@/components/LOS/Approval/ApprovalHistory";
import SanctionDashboard from "@/components/LOS/Sanction/SanctionDashboard";
import DisbursementDashboard from "@/components/LOS/Disbursement/DisbursementDashboard";
import EMIDashboard from "@/components/LOS/EMI/EMIDashboard";

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
  const { orgId, isLoading: isOrgLoading } = useOrgContext();
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
          loan_applicants(*)
        `)
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!orgId,
  });

  // Fetch parsed document data
  const { data: documents = [] } = useQuery({
    queryKey: ["loan-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("loan_application_id", id);
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

  const formatAddress = (address: any) => {
    if (!address) return "N/A";
    if (typeof address === "string") return address;
    
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.pincode
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  // Get parsed data from documents
  const getParsedData = (docType: string) => {
    const doc = documents.find((d) => d.document_type === docType);
    return doc?.ocr_data as Record<string, any> | null;
  };

  const panData = getParsedData("pan_card");
  const aadhaarData = getParsedData("aadhaar_card");

  if (isLoading || isOrgLoading) {
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
  const tenureDays = application.tenure_months * 30;

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
              <div className="text-2xl font-bold">{tenureDays} days</div>
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
            <TabsTrigger value="emi">
              <CreditCard className="h-4 w-4 mr-2" />
              EMI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="application" className="space-y-4">
            {/* Applicant Details Card */}
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
                      <p className="text-sm">{formatAddress(primaryApplicant.current_address)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parsed Document Data Card */}
            {(panData || aadhaarData) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Verified Document Data
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">AI Parsed</Badge>
                  </CardTitle>
                  <CardDescription>Information extracted from uploaded documents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* PAN Card Data */}
                    {panData && !panData.parse_error && (
                      <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          PAN Card
                        </h4>
                        <div className="grid gap-2 text-sm">
                          {panData.name && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Name</span>
                              <span className="font-medium">{panData.name}</span>
                            </div>
                          )}
                          {panData.pan_number && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">PAN</span>
                              <span className="font-mono font-medium">{panData.pan_number}</span>
                            </div>
                          )}
                          {panData.father_name && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Father's Name</span>
                              <span className="font-medium">{panData.father_name}</span>
                            </div>
                          )}
                          {panData.dob && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">DOB</span>
                              <span className="font-medium">
                                {format(new Date(panData.dob), "MMM dd, yyyy")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Aadhaar Card Data */}
                    {aadhaarData && !aadhaarData.parse_error && (
                      <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Aadhaar Card
                        </h4>
                        <div className="grid gap-2 text-sm">
                          {aadhaarData.name && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Name</span>
                              <span className="font-medium">{aadhaarData.name}</span>
                            </div>
                          )}
                          {aadhaarData.aadhaar_number && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Aadhaar</span>
                              <span className="font-mono font-medium">{aadhaarData.aadhaar_number}</span>
                            </div>
                          )}
                          {aadhaarData.gender && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Gender</span>
                              <span className="font-medium">{aadhaarData.gender}</span>
                            </div>
                          )}
                          {aadhaarData.dob && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">DOB</span>
                              <span className="font-medium">
                                {format(new Date(aadhaarData.dob), "MMM dd, yyyy")}
                              </span>
                            </div>
                          )}
                          {aadhaarData.address && (
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Address</span>
                              <span className="font-medium text-xs">{aadhaarData.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Document Data Verification */}
            <DocumentDataVerification applicationId={application.id} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <DocumentUpload applicationId={application.id} orgId={orgId} />
            <IncomeSummary applicationId={application.id} orgId={orgId} />
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
            <DisbursementDashboard applicationId={application.id} />
          </TabsContent>

          <TabsContent value="emi">
            <EMIDashboard applicationId={application.id} />
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