import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, User } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { format } from "date-fns";
import DisbursementDashboard from "@/components/LOS/Disbursement/DisbursementDashboard";
import SanctionGenerator from "@/components/LOS/Sanction/SanctionGenerator";
import UploadSignedDocumentDialog from "@/components/LOS/Sanction/UploadSignedDocumentDialog";
import { useOrgContext } from "@/hooks/useOrgContext";
import { ApplicantProfileCard } from "@/components/LOS/ApplicantProfileCard";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted",
  in_progress: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  disbursed: "bg-purple-500",
};

const formatAddress = (address: any) => {
  if (!address) return "N/A";
  if (typeof address === "string") return address;
  const parts = [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
};

export default function SanctionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const { data: application, isLoading } = useQuery({
    queryKey: ["sanction-application", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants(
            id, first_name, middle_name, last_name, 
            dob, gender, marital_status, religion, 
            pan_number, aadhaar_number, mobile, current_address
          ),
          approved_by_profile:profiles!loan_applications_approved_by_fkey(first_name, last_name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sanction } = useQuery({
    queryKey: ["loan-sanction-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", id)
        .maybeSingle();
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
  const canUploadSigned = sanction?.documents_emailed_at && sanction?.status !== 'signed';

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
                {sanction?.status === 'signed' && (
                  <Badge className="bg-green-500">Documents Signed</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                {primaryApplicant && `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`}
                {" • "}
                {formatCurrency(application.approved_amount || application.requested_amount)}
                {" • "}
                Created {format(new Date(application.created_at), "MMM dd, yyyy")}
                {application.approved_by_profile && (
                  <>
                    {" • "}
                    <span className="text-green-600 font-medium">
                      Approved by {application.approved_by_profile.first_name} {application.approved_by_profile.last_name || ""}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canUploadSigned && (
              <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Signed Document
              </Button>
            )}
            <SanctionGenerator applicationId={application.id} orgId={orgId || ""} />
          </div>
        </div>

        {/* Applicant Profile Card */}
        {primaryApplicant && orgId && (
          <ApplicantProfileCard
            applicationId={id!}
            orgId={orgId}
            applicant={primaryApplicant}
            applicantName={`${primaryApplicant.first_name} ${primaryApplicant.middle_name || ''} ${primaryApplicant.last_name || ''}`.trim()}
            panNumber={primaryApplicant.pan_number}
            aadhaarNumber={primaryApplicant.aadhaar_number}
            mobile={primaryApplicant.mobile}
            dateOfBirth={primaryApplicant.dob}
            gender={primaryApplicant.gender}
          />
        )}

        {/* Applicant Details Card */}
        {primaryApplicant && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Applicant Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-x-4 gap-y-2 md:grid-cols-4">
                <div>
                  <label className="text-xs text-muted-foreground">Full Name</label>
                  <p className="text-sm">{primaryApplicant.first_name} {primaryApplicant.middle_name || ""} {primaryApplicant.last_name || ""}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Date of Birth</label>
                  <p className="text-sm">{primaryApplicant.dob ? format(new Date(primaryApplicant.dob), "MMM dd, yyyy") : "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Gender</label>
                  <p className="text-sm">{primaryApplicant.gender || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Marital Status</label>
                  <p className="text-sm">{primaryApplicant.marital_status || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Religion</label>
                  <p className="text-sm capitalize">{primaryApplicant.religion || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">PAN Number</label>
                  <p className="text-sm font-mono">{primaryApplicant.pan_number || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Mobile</label>
                  <p className="text-sm">{primaryApplicant.mobile || "N/A"}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Current Address</label>
                  <p className="text-sm">{formatAddress(primaryApplicant.current_address)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sanction Content - Loan Summary & Documents */}
        <DisbursementDashboard applicationId={application.id} />
      </div>

      {sanction && (
        <UploadSignedDocumentDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          applicationId={application.id}
          sanctionId={sanction.id}
          orgId={orgId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["loan-sanction-detail", id] });
          }}
        />
      )}
    </DashboardLayout>
  );
}