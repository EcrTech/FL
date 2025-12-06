import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle, User } from "lucide-react";
import { LoanDetailsStep } from "@/components/PublicLoanApplication/LoanDetailsStep";
import { PersonalDetailsStep } from "@/components/PublicLoanApplication/PersonalDetailsStep";
import { AddressDetailsStep } from "@/components/PublicLoanApplication/AddressDetailsStep";
import { EmploymentDetailsStep } from "@/components/PublicLoanApplication/EmploymentDetailsStep";
import { DocumentUploadStep } from "@/components/PublicLoanApplication/DocumentUploadStep";
import { ReviewStep } from "@/components/PublicLoanApplication/ReviewStep";
import { SuccessScreen } from "@/components/PublicLoanApplication/SuccessScreen";
import { LoadingState } from "@/components/common/LoadingState";
import { LoanFormData } from "@/pages/PublicLoanApplication";

interface ReferrerInfo {
  referralCode: string;
  referrerName: string | null;
  referrerUserId: string;
  orgId: string;
}

const STEPS = [
  { id: 1, name: "Loan Details", description: "Amount & Purpose" },
  { id: 2, name: "Personal Details", description: "Your Information" },
  { id: 3, name: "Address", description: "Residence Details" },
  { id: 4, name: "Employment", description: "Work Information" },
  { id: 5, name: "Documents", description: "Upload Documents" },
  { id: 6, name: "Review", description: "Confirm & Submit" },
];

const initialFormData: LoanFormData = {
  loanDetails: { productType: "personal_loan", amount: "", tenure: 360 }, // Default 360 days (12 months)
  personalDetails: {
    fullName: "",
    dob: "",
    gender: "",
    maritalStatus: "",
    panNumber: "",
    aadhaarNumber: "",
    email: "",
    mobile: "",
    fatherName: "",
  },
  addressDetails: {
    currentAddress: { addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" },
    permanentAddress: { addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" },
    sameAsCurrent: true,
    residenceType: "",
  },
  employmentDetails: {
    employmentType: "salaried",
    employerName: "",
    employerType: "",
    designation: "",
    grossSalary: "",
    netSalary: "",
    bankName: "",
    accountNumber: "",
  },
  documents: [],
};

export default function ReferralLoanApplication() {
  const { referralCode } = useParams<{ referralCode: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [geolocation, setGeolocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [formStartTime] = useState(Date.now());
  const [honeypot, setHoneypot] = useState("");

  // Fetch referrer info
  useEffect(() => {
    const fetchReferrerInfo = async () => {
      if (!referralCode) {
        setError("Invalid referral link");
        setLoading(false);
        return;
      }

      try {
        console.log("[ReferralLoanApplication] Validating referral code:", referralCode);
        
        // Validate the referral code (public access via RLS policy)
        const { data, error: fetchError } = await supabase
          .from("user_referral_codes")
          .select("referral_code, user_id, org_id")
          .eq("referral_code", referralCode)
          .eq("is_active", true)
          .maybeSingle();

        console.log("[ReferralLoanApplication] Query result:", { data, error: fetchError });

        if (fetchError) {
          console.error("[ReferralLoanApplication] Database error:", fetchError.message, fetchError.code);
          setError("Unable to validate referral link. Please try again.");
          setLoading(false);
          return;
        }

        if (!data) {
          console.log("[ReferralLoanApplication] No matching referral code found");
          setError("This referral link is invalid or has expired");
          setLoading(false);
          return;
        }

        // Profile lookup is optional - may fail for unauthenticated users due to RLS
        let referrerName: string | null = null;
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", data.user_id)
          .maybeSingle();
        
        if (profileData) {
          referrerName = [profileData.first_name, profileData.last_name].filter(Boolean).join(" ") || null;
        }
        console.log("[ReferralLoanApplication] Profile lookup:", { profileData, profileError: profileError?.message });

        setReferrerInfo({
          referralCode: data.referral_code,
          referrerName,
          referrerUserId: data.user_id,
          orgId: data.org_id,
        });
        setLoading(false);
        console.log("[ReferralLoanApplication] Form loaded successfully");
      } catch (err) {
        console.error("[ReferralLoanApplication] Unexpected error:", err);
        setError("Unable to load application form. Please try again.");
        setLoading(false);
      }
    };

    fetchReferrerInfo();
  }, [referralCode]);

  // Get geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeolocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (err) => console.log("Geolocation error:", err)
      );
    }
  }, []);

  const updateFormData = (section: keyof LoanFormData, data: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...data },
    }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    if (!referrerInfo) return;

    setSubmitting(true);
    try {
      const { data, error: submitError } = await supabase.functions.invoke("submit-loan-application", {
        body: {
          formSlug: "referral",
          referralCode: referrerInfo.referralCode,
          loanDetails: {
            amount: formData.loanDetails.amount,
            tenure: formData.loanDetails.tenure,
          },
          personalDetails: formData.personalDetails,
          addressDetails: formData.addressDetails,
          employmentDetails: {
            ...formData.employmentDetails,
            grossSalary: parseFloat(formData.employmentDetails.grossSalary) || 0,
            netSalary: parseFloat(formData.employmentDetails.netSalary) || 0,
          },
          documents: formData.documents.map(doc => ({
            type: doc.type,
            base64: doc.base64,
            name: doc.name,
            mimeType: doc.mimeType,
          })),
          geolocation,
          formStartTime,
          honeypot,
        },
      });

      if (submitError) throw submitError;

      if (data?.success) {
        setApplicationNumber(data.applicationNumber);
        toast.success("Application submitted successfully!");
      } else {
        throw new Error(data?.error || "Failed to submit application");
      }
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <LoadingState message="Loading application form..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Invalid Referral Link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Please contact your referrer for a valid link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (applicationNumber) {
    return <SuccessScreen applicationNumber={applicationNumber} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Loan Application</h1>
          <p className="text-muted-foreground">
            Complete the form below to apply for a loan
          </p>
          {referrerInfo?.referrerName && (
            <Badge variant="secondary" className="gap-2">
              <User className="h-3 w-3" />
              Referred by {referrerInfo.referrerName}
            </Badge>
          )}
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].name}
                </span>
                <span className="text-muted-foreground">{Math.round(progress)}% complete</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between">
                {STEPS.map((step) => (
                  <div
                    key={step.id}
                    className={`flex flex-col items-center ${
                      step.id === currentStep
                        ? "text-primary"
                        : step.id < currentStep
                        ? "text-green-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        step.id < currentStep
                          ? "bg-green-500 text-white"
                          : step.id === currentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {step.id < currentStep ? <CheckCircle className="h-4 w-4" /> : step.id}
                    </div>
                    <span className="text-xs mt-1 hidden sm:block">{step.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Honeypot (hidden) */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ position: "absolute", left: "-9999px" }}
          tabIndex={-1}
          autoComplete="off"
        />

        {/* Form Steps */}
        <Card>
          <CardContent className="pt-6">
            {currentStep === 1 && (
              <LoanDetailsStep
                data={formData.loanDetails}
                onChange={(data) => updateFormData("loanDetails", data)}
                onNext={nextStep}
              />
            )}
            {currentStep === 2 && (
              <PersonalDetailsStep
                data={formData.personalDetails}
                onChange={(data) => updateFormData("personalDetails", data)}
                onNext={nextStep}
                onPrev={prevStep}
              />
            )}
            {currentStep === 3 && (
              <AddressDetailsStep
                data={formData.addressDetails}
                onChange={(data) => updateFormData("addressDetails", data)}
                onNext={nextStep}
                onPrev={prevStep}
              />
            )}
            {currentStep === 4 && (
              <EmploymentDetailsStep
                data={formData.employmentDetails}
                onChange={(data) => updateFormData("employmentDetails", data)}
                onNext={nextStep}
                onPrev={prevStep}
              />
            )}
            {currentStep === 5 && (
              <DocumentUploadStep
                data={formData.documents}
                requiredDocuments={["pan_card", "aadhaar_card", "salary_slip"]}
                onChange={(docs) => setFormData((prev) => ({ ...prev, documents: docs }))}
                onNext={nextStep}
                onPrev={prevStep}
              />
            )}
            {currentStep === 6 && (
              <ReviewStep 
                formData={formData} 
                onSubmit={handleSubmit}
                onPrev={prevStep}
                onEdit={goToStep} 
                submitting={submitting}
              />
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By submitting this application, you agree to our terms and conditions.
          Your information is securely encrypted.
        </p>
      </div>
    </div>
  );
}
