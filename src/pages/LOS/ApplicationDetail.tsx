import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, FileText, Calculator, FileCheck, DollarSign, XCircle, CreditCard, CheckCircle, MapPin, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/common/LoadingState";
import { format } from "date-fns";
import DocumentUpload from "@/components/LOS/DocumentUpload";
import DocumentDataVerification from "@/components/LOS/DocumentDataVerification";
import IncomeSummary from "@/components/LOS/IncomeSummary";
import AssessmentDashboard from "@/components/LOS/Assessment/AssessmentDashboard";
import ApprovalActionDialog from "@/components/LOS/Approval/ApprovalActionDialog";
import ApprovalHistory from "@/components/LOS/Approval/ApprovalHistory";
import DisbursementForm from "@/components/LOS/Disbursement/DisbursementForm";
import DisbursementStatus from "@/components/LOS/Disbursement/DisbursementStatus";
import { ApplicantProfileCard } from "@/components/LOS/ApplicantProfileCard";

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

// Referrals Section Component
interface ReferralsSectionProps {
  primaryApplicant: any;
  applicationId: string;
  orgId: string;
  isEditingReferrals: boolean;
  setIsEditingReferrals: (value: boolean) => void;
  referralData: {
    professional_ref_name: string;
    professional_ref_mobile: string;
    professional_ref_email: string;
    professional_ref_address: string;
    personal_ref_name: string;
    personal_ref_mobile: string;
    personal_ref_email: string;
    personal_ref_address: string;
  };
  setReferralData: (data: any) => void;
  queryClient: any;
}

function ReferralsSection({
  primaryApplicant,
  applicationId,
  orgId,
  isEditingReferrals,
  setIsEditingReferrals,
  referralData,
  setReferralData,
  queryClient,
}: ReferralsSectionProps) {
  useEffect(() => {
    if (primaryApplicant) {
      setReferralData({
        professional_ref_name: primaryApplicant.professional_ref_name || "",
        professional_ref_mobile: primaryApplicant.professional_ref_mobile || "",
        professional_ref_email: primaryApplicant.professional_ref_email || "",
        professional_ref_address: primaryApplicant.professional_ref_address || "",
        personal_ref_name: primaryApplicant.personal_ref_name || "",
        personal_ref_mobile: primaryApplicant.personal_ref_mobile || "",
        personal_ref_email: primaryApplicant.personal_ref_email || "",
        personal_ref_address: primaryApplicant.personal_ref_address || "",
      });
    }
  }, [primaryApplicant, setReferralData]);

  const saveReferralsMutation = useMutation({
    mutationFn: async (data: typeof referralData) => {
      if (!primaryApplicant?.id) {
        throw new Error("No applicant record found");
      }
      const { error } = await supabase
        .from("loan_applicants")
        .update(data)
        .eq("id", primaryApplicant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referral information saved successfully");
      setIsEditingReferrals(false);
      queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId, orgId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save referral information");
    },
  });

  const handleSave = () => {
    saveReferralsMutation.mutate(referralData);
  };

  const handleCancel = () => {
    if (primaryApplicant) {
      setReferralData({
        professional_ref_name: primaryApplicant.professional_ref_name || "",
        professional_ref_mobile: primaryApplicant.professional_ref_mobile || "",
        professional_ref_email: primaryApplicant.professional_ref_email || "",
        professional_ref_address: primaryApplicant.professional_ref_address || "",
        personal_ref_name: primaryApplicant.personal_ref_name || "",
        personal_ref_mobile: primaryApplicant.personal_ref_mobile || "",
        personal_ref_email: primaryApplicant.personal_ref_email || "",
        personal_ref_address: primaryApplicant.personal_ref_address || "",
      });
    }
    setIsEditingReferrals(false);
  };

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-muted-foreground">Referrals</h4>
        {primaryApplicant && !isEditingReferrals && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditingReferrals(true)}>
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
        {isEditingReferrals && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveReferralsMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {saveReferralsMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {!primaryApplicant && (
        <p className="text-sm text-muted-foreground">No applicant record found. Referral information cannot be added.</p>
      )}

      {primaryApplicant && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Professional Reference */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <h5 className="text-sm font-medium mb-3">Professional Reference</h5>
            <div className="grid gap-3">
              {isEditingReferrals ? (
                <>
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={referralData.professional_ref_name}
                      onChange={(e) => setReferralData({ ...referralData, professional_ref_name: e.target.value })}
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mobile</Label>
                    <Input
                      value={referralData.professional_ref_mobile}
                      onChange={(e) => setReferralData({ ...referralData, professional_ref_mobile: e.target.value })}
                      placeholder="Enter mobile"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={referralData.professional_ref_email}
                      onChange={(e) => setReferralData({ ...referralData, professional_ref_email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Address</Label>
                    <Input
                      value={referralData.professional_ref_address}
                      onChange={(e) => setReferralData({ ...referralData, professional_ref_address: e.target.value })}
                      placeholder="Enter address"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    <p className="text-sm">{primaryApplicant.professional_ref_name || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mobile</label>
                    <p className="text-sm">{primaryApplicant.professional_ref_mobile || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <p className="text-sm">{primaryApplicant.professional_ref_email || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Address</label>
                    <p className="text-sm">{primaryApplicant.professional_ref_address || "N/A"}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Personal Reference */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <h5 className="text-sm font-medium mb-3">Personal Reference</h5>
            <div className="grid gap-3">
              {isEditingReferrals ? (
                <>
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={referralData.personal_ref_name}
                      onChange={(e) => setReferralData({ ...referralData, personal_ref_name: e.target.value })}
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mobile</Label>
                    <Input
                      value={referralData.personal_ref_mobile}
                      onChange={(e) => setReferralData({ ...referralData, personal_ref_mobile: e.target.value })}
                      placeholder="Enter mobile"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={referralData.personal_ref_email}
                      onChange={(e) => setReferralData({ ...referralData, personal_ref_email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Address</Label>
                    <Input
                      value={referralData.personal_ref_address}
                      onChange={(e) => setReferralData({ ...referralData, personal_ref_address: e.target.value })}
                      placeholder="Enter address"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    <p className="text-sm">{primaryApplicant.personal_ref_name || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mobile</label>
                    <p className="text-sm">{primaryApplicant.personal_ref_mobile || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <p className="text-sm">{primaryApplicant.personal_ref_email || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Address</label>
                    <p className="text-sm">{primaryApplicant.personal_ref_address || "N/A"}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReviewMode = searchParams.get("mode") === "review";
  const { orgId, isLoading: isOrgLoading } = useOrgContext();
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);
  const [isEditingReferrals, setIsEditingReferrals] = useState(false);
  const [referralData, setReferralData] = useState({
    professional_ref_name: "",
    professional_ref_mobile: "",
    professional_ref_email: "",
    professional_ref_address: "",
    personal_ref_name: "",
    personal_ref_mobile: "",
    personal_ref_email: "",
    personal_ref_address: "",
  });
  const queryClient = useQueryClient();

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
          loan_verifications(*)
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
    enabled: !!id && !!orgId,
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

  // Get verification data from application (loaded with loan_verifications relation)
  const verifications = (application as any)?.loan_verifications || [];
  const getVerificationData = (verType: string) => {
    const ver = verifications.find((v: any) => v.verification_type === verType);
    return ver?.response_data as Record<string, any> | null;
  };

  // Merge document OCR data with verification data
  const panDocData = getParsedData("pan_card");
  const panVerData = getVerificationData("pan");
  const panData: Record<string, any> | null = panDocData || panVerData
    ? {
        ...panVerData,
        ...panDocData,
        // Normalize common PAN fields from different sources
        name: panDocData?.name || panVerData?.name_on_pan || panVerData?.name,
        pan_number:
          panDocData?.pan_number ||
          (panVerData as any)?.pan_number ||
          (panVerData as any)?.pan,
        father_name: panDocData?.father_name || panVerData?.father_name,
        dob: panDocData?.dob || panVerData?.dob,
        status:
          panDocData?.status ||
          (panVerData as any)?.pan_status ||
          (panVerData as any)?.status,
      }
    : null;

  const aadhaarDocData = getParsedData("aadhaar_card");
  const aadhaarVerData = getVerificationData("aadhaar");
  const aadhaarData: Record<string, any> | null = aadhaarDocData || aadhaarVerData ? { 
    ...aadhaarVerData, 
    ...aadhaarDocData,
    // Ensure address from verification is available, including nested structures
    address:
      aadhaarDocData?.address ||
      aadhaarVerData?.verified_address ||
      aadhaarVerData?.address?.combined ||
      aadhaarVerData?.address
  } : null;

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
  const tenureDays = application.tenure_days;

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
                  {application.loan_id || application.application_number}
                </h1>
                <Badge className={STATUS_COLORS[application.status]}>
                  {application.status.replace("_", " ").toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {STAGE_LABELS[application.current_stage] || application.current_stage}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {application.loan_id && (
                  <span className="mr-2">Application: {application.application_number} •</span>
                )}
                Created {format(new Date(application.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-5">
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
                  ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`.trim()
                  : application.contacts
                  ? `${application.contacts.first_name} ${application.contacts.last_name || ""}`.trim()
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              {application.latitude && application.longitude ? (
                <div className="space-y-1">
                  <div className="text-xs font-mono text-muted-foreground">
                    {Number(application.latitude).toFixed(6)}, {Number(application.longitude).toFixed(6)}
                  </div>
                  {application.geolocation_accuracy && (
                    <div className="text-xs text-muted-foreground">
                      ±{Math.round(Number(application.geolocation_accuracy))}m accuracy
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Not captured</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Applicant Profile with Documents */}
        {primaryApplicant && (
          <ApplicantProfileCard
            applicationId={id!}
            applicantName={`${primaryApplicant.first_name} ${primaryApplicant.middle_name || ''} ${primaryApplicant.last_name || ''}`.trim()}
            panNumber={primaryApplicant.pan_number as string}
            aadhaarNumber={primaryApplicant.aadhaar_number as string}
            mobile={primaryApplicant.mobile as string}
            dateOfBirth={primaryApplicant.dob && !isNaN(new Date(primaryApplicant.dob as string).getTime())
              ? format(new Date(primaryApplicant.dob as string), "MMM dd, yyyy")
              : undefined}
            gender={primaryApplicant.gender as string}
          />
        )}

        {/* Application Details Section */}
        <div className="space-y-6">
          {/* Applicant Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Applicant Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {primaryApplicant ? (
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
                      {primaryApplicant.dob && !isNaN(new Date(primaryApplicant.dob as string).getTime())
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
              ) : (
                <p className="text-sm text-muted-foreground">No applicant details available. Please add applicant information.</p>
              )}

              {/* Referrals Section - Always visible with edit capability */}
              <ReferralsSection
                primaryApplicant={primaryApplicant}
                applicationId={id!}
                orgId={orgId!}
                isEditingReferrals={isEditingReferrals}
                setIsEditingReferrals={setIsEditingReferrals}
                referralData={referralData}
                setReferralData={setReferralData}
                queryClient={queryClient}
              />
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
                        {panData.dob && !isNaN(new Date(panData.dob).getTime()) && (
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
                        {aadhaarData.dob && !isNaN(new Date(aadhaarData.dob).getTime()) && (
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

          {/* Documents Section */}
          <DocumentUpload applicationId={application.id} orgId={orgId} applicant={primaryApplicant} />

          {/* Sections only visible in review mode - contextual based on stage */}
          {isReviewMode && (
            <>
              {/* Income & Assessment - shown until approval */}
              {!["sanctioned", "disbursement_pending", "disbursed", "closed"].includes(application.current_stage) && (
                <>
                  <IncomeSummary applicationId={application.id} orgId={orgId} />
                  <AssessmentDashboard applicationId={application.id} orgId={orgId} />
                </>
              )}
              
              {/* Approval Actions - Only shown when stage is approval_pending */}
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

              {/* Approval History - shown for approval stages and beyond */}
              {["approval_pending", "sanctioned", "disbursement_pending", "disbursed", "closed"].includes(application.current_stage) && (
                <ApprovalHistory applicationId={id!} />
              )}

              {/* Disbursement Section */}
              {application.current_stage === "disbursement_pending" && (
                <DisbursementForm applicationId={id!} />
              )}
            </>
          )}

          {/* Disbursement Status - always visible for disbursed applications */}
          {application.current_stage === "disbursed" && (
            <DisbursementStatus applicationId={id!} />
          )}
        </div>
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