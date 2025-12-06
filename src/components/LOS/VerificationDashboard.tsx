import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Edit, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PANVerificationDialog from "./Verification/PANVerificationDialog";
import AadhaarVerificationDialog from "./Verification/AadhaarVerificationDialog";
import EmploymentVerificationDialog from "./Verification/EmploymentVerificationDialog";
import BankAnalysisDialog from "./Verification/BankAnalysisDialog";
import CreditBureauDialog from "./Verification/CreditBureauDialog";
import { VideoKYCDialog } from "./Verification/VideoKYCDialog";
import BankAccountVerificationDialog from "./Verification/BankAccountVerificationDialog";

interface VerificationDashboardProps {
  applicationId: string;
  orgId: string;
}

const VERIFICATION_TYPES = [
  { 
    type: "video_kyc", 
    name: "Video KYC", 
    description: "Live video verification session",
    category: "identity"
  },
  { 
    type: "pan", 
    name: "PAN Verification", 
    description: "Verify PAN card details via NSDL",
    category: "identity"
  },
  { 
    type: "aadhaar", 
    name: "Aadhaar Verification", 
    description: "Verify Aadhaar details via UIDAI",
    category: "identity"
  },
  { 
    type: "bank_account", 
    name: "Bank Account Verification", 
    description: "Verify bank account via penny drop",
    category: "financial"
  },
  { 
    type: "employment", 
    name: "Employment Verification", 
    description: "Verify employment via EPFO",
    category: "employment"
  },
  { 
    type: "bank_statement", 
    name: "Bank Statement Analysis", 
    description: "Analyze 6-month bank statements",
    category: "financial"
  },
  { 
    type: "credit_bureau", 
    name: "Credit Bureau Check", 
    description: "Fetch credit score and report",
    category: "credit"
  },
];

const STATUS_CONFIG = {
  pending: { color: "bg-muted", icon: Clock, label: "Pending", textColor: "text-muted-foreground" },
  in_progress: { color: "bg-blue-500", icon: Clock, label: "In Progress", textColor: "text-blue-600" },
  success: { color: "bg-green-500", icon: CheckCircle, label: "Verified", textColor: "text-green-600" },
  failed: { color: "bg-red-500", icon: XCircle, label: "Failed", textColor: "text-red-600" },
};

export default function VerificationDashboard({ applicationId, orgId }: VerificationDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVerification, setSelectedVerification] = useState<{ type: string; data: any } | null>(null);

  const { data: verifications = [], isLoading } = useQuery({
    queryKey: ["loan-verifications", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_verifications")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*, loan_applicants(*)")
        .eq("id", applicationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const updateStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const { error } = await supabase
        .from("loan_applications")
        .update({ 
          current_stage: newStage,
          updated_at: new Date().toISOString()
        })
        .eq("id", applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      toast({ title: "Application stage updated" });
    },
  });

  const getVerificationStatus = (type: string) => {
    const verification = verifications.find((v) => v.verification_type === type);
    return verification ? verification.status : "pending";
  };

  const getVerification = (type: string) => {
    return verifications.find((v) => v.verification_type === type);
  };

  const allVerificationsComplete = VERIFICATION_TYPES.every(
    (v) => getVerificationStatus(v.type) === "success"
  );

  const anyVerificationFailed = VERIFICATION_TYPES.some(
    (v) => getVerificationStatus(v.type) === "failed"
  );

  const handleMoveToAssessment = () => {
    if (allVerificationsComplete) {
      updateStageMutation.mutate("credit_assessment");
    }
  };

  const primaryApplicant = application?.loan_applicants?.[0];

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Summary</CardTitle>
          <CardDescription>
            Complete all verifications to proceed to credit assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-2xl font-bold">
                {VERIFICATION_TYPES.filter((v) => getVerificationStatus(v.type) === "success").length}/
                {VERIFICATION_TYPES.length}
              </div>
              <p className="text-sm text-muted-foreground">Verifications Complete</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {VERIFICATION_TYPES.filter((v) => getVerificationStatus(v.type) === "in_progress").length}
              </div>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {VERIFICATION_TYPES.filter((v) => getVerificationStatus(v.type) === "failed").length}
              </div>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>

          {allVerificationsComplete && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-900">All verifications complete!</p>
                </div>
                <Button onClick={handleMoveToAssessment}>
                  Move to Credit Assessment
                </Button>
              </div>
            </div>
          )}

          {anyVerificationFailed && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="font-medium text-red-900">
                  Some verifications have failed. Review and retry.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {VERIFICATION_TYPES.map((verificationType) => {
          const status = getVerificationStatus(verificationType.type);
          const verification = getVerification(verificationType.type);
          const StatusIcon = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].icon;

          return (
            <Card key={verificationType.type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].textColor}`} />
                    <div>
                      <CardTitle className="text-lg">{verificationType.name}</CardTitle>
                      <CardDescription>{verificationType.description}</CardDescription>
                    </div>
                  </div>
                  <Badge className={STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].color}>
                    {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Display matched/verified details */}
                {verification?.response_data && typeof verification.response_data === 'object' && !Array.isArray(verification.response_data) && (
                  <div className="mb-3 p-3 bg-muted/50 rounded-md border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Verified Details</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {verificationType.type === "pan" && (
                        <>
                          {(verification.response_data as Record<string, any>).name_on_pan && (
                            <div>
                              <span className="text-muted-foreground">Name: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).name_on_pan}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).pan_status && (
                            <div>
                              <span className="text-muted-foreground">Status: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).pan_status === "valid" ? "default" : "destructive"} className="text-xs">
                                {(verification.response_data as Record<string, any>).pan_status}
                              </Badge>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).name_match_result && (
                            <div>
                              <span className="text-muted-foreground">Name Match: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).name_match_result === "exact" ? "default" : "secondary"} className="text-xs">
                                {(verification.response_data as Record<string, any>).name_match_result}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "aadhaar" && (
                        <>
                          {(verification.response_data as Record<string, any>).name_on_aadhaar && (
                            <div>
                              <span className="text-muted-foreground">Name: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).name_on_aadhaar}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).address_match && (
                            <div>
                              <span className="text-muted-foreground">Address Match: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).address_match === "exact" ? "default" : "secondary"} className="text-xs">
                                {(verification.response_data as Record<string, any>).address_match}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "bank_account" && (
                        <>
                          {(verification.response_data as Record<string, any>).account_holder_name && (
                            <div>
                              <span className="text-muted-foreground">Holder: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).account_holder_name}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).account_status && (
                            <div>
                              <span className="text-muted-foreground">Status: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).account_status === "active" ? "default" : "destructive"} className="text-xs">
                                {(verification.response_data as Record<string, any>).account_status}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "employment" && (
                        <>
                          {(verification.response_data as Record<string, any>).employer_name && (
                            <div>
                              <span className="text-muted-foreground">Employer: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).employer_name}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).employment_status && (
                            <div>
                              <span className="text-muted-foreground">Status: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).employment_status === "employed" ? "default" : "secondary"} className="text-xs">
                                {(verification.response_data as Record<string, any>).employment_status}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "credit_bureau" && (
                        <>
                          {(verification.response_data as Record<string, any>).credit_score && (
                            <div>
                              <span className="text-muted-foreground">Score: </span>
                              <span className="font-bold">{(verification.response_data as Record<string, any>).credit_score}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).score_range && (
                            <div>
                              <span className="text-muted-foreground">Range: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).score_range}</span>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "bank_statement" && (
                        <>
                          {(verification.response_data as Record<string, any>).average_balance && (
                            <div>
                              <span className="text-muted-foreground">Avg Balance: </span>
                              <span className="font-medium">₹{Number((verification.response_data as Record<string, any>).average_balance).toLocaleString()}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).monthly_credits && (
                            <div>
                              <span className="text-muted-foreground">Monthly Credits: </span>
                              <span className="font-medium">₹{Number((verification.response_data as Record<string, any>).monthly_credits).toLocaleString()}</span>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "video_kyc" && (
                        <>
                          {(verification.response_data as Record<string, any>).face_match_score && (
                            <div>
                              <span className="text-muted-foreground">Face Match: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).face_match_score}%</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).liveness_check && (
                            <div>
                              <span className="text-muted-foreground">Liveness: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).liveness_check === "passed" ? "default" : "destructive"} className="text-xs">
                                {(verification.response_data as Record<string, any>).liveness_check}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {verification && verification.remarks && (
                  <div className="mb-3 p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">{verification.remarks}</p>
                  </div>
                )}

                <Button
                  variant={status === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedVerification({ type: verificationType.type, data: verification })}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {status === "pending" ? "Start Verification" : "Update"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Verification Dialogs */}
      {selectedVerification?.type === "video_kyc" && (
        <VideoKYCDialog
          open={true}
          onOpenChange={(open) => !open && setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          onVerificationComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
            setSelectedVerification(null);
          }}
        />
      )}

      {selectedVerification?.type === "pan" && (
        <PANVerificationDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}

      {selectedVerification?.type === "aadhaar" && (
        <AadhaarVerificationDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}

      {selectedVerification?.type === "bank_account" && (
        <BankAccountVerificationDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}

      {selectedVerification?.type === "employment" && (
        <EmploymentVerificationDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}

      {selectedVerification?.type === "bank_statement" && (
        <BankAnalysisDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}

      {selectedVerification?.type === "credit_bureau" && (
        <CreditBureauDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}
    </div>
  );
}
