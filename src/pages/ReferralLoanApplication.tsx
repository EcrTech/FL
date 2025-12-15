import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, User, CreditCard, FileCheck, Video, ArrowLeft, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BasicInfoStep } from "@/components/ReferralApplication/BasicInfoStep";
import { PANVerificationStep } from "@/components/ReferralApplication/PANVerificationStep";
import { AadhaarVerificationStep } from "@/components/ReferralApplication/AadhaarVerificationStep";
import { VideoKYCStep } from "@/components/ReferralApplication/VideoKYCStep";
import logo from "@/assets/paisarthi-logo.png";

interface ReferrerInfo {
  name: string;
  email: string;
  phone: string;
  orgId: string;
  userId: string;
}

const STEPS = [
  { id: 1, title: "Personal Details", icon: User },
  { id: 2, title: "PAN Verification", icon: CreditCard },
  { id: 3, title: "Aadhaar Verification", icon: FileCheck },
  { id: 4, title: "Video KYC", icon: Video },
];

export default function ReferralLoanApplication() {
  const { referralCode } = useParams<{ referralCode: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Form data
  const [basicInfo, setBasicInfo] = useState({
    name: "",
    email: "",
    phone: "",
    requestedAmount: 0,
    tenureDays: 0,
  });

  const [consents, setConsents] = useState({
    householdIncome: false,
    termsAndConditions: false,
    aadhaarConsent: false,
  });

  const [verificationStatus, setVerificationStatus] = useState({
    emailVerified: false,
    phoneVerified: false,
  });

  const [panNumber, setPanNumber] = useState("");
  const [panVerified, setPanVerified] = useState(false);
  const [panData, setPanData] = useState<{ name: string; status: string } | undefined>();

  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarData, setAadhaarData] = useState<{ name: string; address: string; dob: string } | undefined>();

  const [videoKycCompleted, setVideoKycCompleted] = useState(false);

  // Fetch referrer info
  useEffect(() => {
    async function fetchReferrerInfo() {
      if (!referralCode) {
        setError("Invalid referral link");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("user_referral_codes")
          .select("user_id, org_id")
          .eq("referral_code", referralCode)
          .eq("is_active", true)
          .single();

        if (fetchError || !data) {
          console.error("Error fetching referral code:", fetchError);
          setError("Invalid or expired referral link");
          setLoading(false);
          return;
        }

        setReferrerInfo({
          name: "Your Loan Advisor",
          email: "",
          phone: "",
          orgId: data.org_id,
          userId: data.user_id,
        });
      } catch (err) {
        console.error("Error fetching referrer:", err);
        setError("Failed to load referral information");
      } finally {
        setLoading(false);
      }
    }

    fetchReferrerInfo();
  }, [referralCode]);

  const handleVerificationComplete = (type: 'email' | 'phone') => {
    setVerificationStatus((prev) => ({
      ...prev,
      [type === 'email' ? 'emailVerified' : 'phoneVerified']: true,
    }));
  };

  const handleConsentChange = (consent: 'householdIncome' | 'termsAndConditions' | 'aadhaarConsent', value: boolean) => {
    setConsents((prev) => ({ ...prev, [consent]: value }));
  };

  const handlePanVerified = (data: { name: string; status: string }) => {
    setPanData(data);
    setPanVerified(true);
  };

  const handleAadhaarVerified = (data: { name: string; address: string; dob: string }) => {
    setAadhaarData(data);
    setAadhaarVerified(true);
  };

  const handleVideoKycComplete = async () => {
    setVideoKycCompleted(true);
    await submitApplication();
  };

  const submitApplication = async () => {
    setSubmitting(true);
    try {
      const applicationData = {
        applicant: {
          name: basicInfo.name,
          email: basicInfo.email,
          phone: basicInfo.phone,
          requestedAmount: basicInfo.requestedAmount,
          tenureDays: basicInfo.tenureDays,
          pan: panNumber,
          panVerified,
          panName: panData?.name,
          aadhaar: aadhaarNumber,
          aadhaarVerified,
          aadhaarName: aadhaarData?.name,
          aadhaarAddress: aadhaarData?.address,
          aadhaarDob: aadhaarData?.dob,
          videoKycCompleted: true,
        },
        consents,
        referrerInfo,
        referralCode,
      };

      const { data, error: submitError } = await supabase.functions.invoke("submit-loan-application", {
        body: applicationData,
      });

      // Check for function invocation error
      if (submitError) throw submitError;

      // Check for error in response data (HTTP non-2xx responses)
      if (data?.error) {
        throw new Error(data.details?.join(', ') || data.error);
      }

      setApplicationNumber(data?.applicationNumber);
      setSubmissionSuccess(true);
      toast.success("Application submitted successfully!");
    } catch (err: any) {
      console.error("Error submitting application:", err);
      toast.error(err.message || "Failed to submit application. Please try again.");
      // Reset video KYC so user can retry
      setVideoKycCompleted(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-body">Loading application...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl border-0">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="w-20 h-20 bg-[hsl(var(--coral-500))]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-heading font-bold text-foreground mb-3">Invalid Referral Link</h2>
            <p className="text-muted-foreground font-body">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success State
  if (submissionSuccess && applicationNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl border-0 animate-fade-in-up">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="w-24 h-24 bg-[hsl(var(--success))] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-heading font-bold text-foreground mb-3">Application Submitted!</h2>
            <p className="text-muted-foreground font-body mb-8">
              Your loan application has been successfully submitted. Our team will review and contact you shortly.
            </p>
            <div className="bg-[hsl(var(--electric-blue-100))] p-6 rounded-2xl border border-[hsl(var(--electric-blue-400))]/20">
              <p className="text-sm text-muted-foreground font-body mb-1">Application Number</p>
              <p className="text-2xl font-heading font-bold text-primary">{applicationNumber}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercentage = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logo} alt="Paisaa Saarthi" className="h-10" />
          <a 
            href="/" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-3">
            Apply for a Loan
          </h1>
          <p className="text-lg text-muted-foreground font-body">
            Complete 4 simple steps to submit your application
          </p>
          {referrerInfo?.name && (
            <div className="inline-flex items-center gap-2 mt-5 bg-[hsl(var(--coral-500))]/10 text-[hsl(var(--coral-600))] px-5 py-2.5 rounded-full text-sm font-semibold font-heading border border-[hsl(var(--coral-400))]/20">
              Referred by {referrerInfo.name}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="progress-bar h-1.5 mb-6">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-between">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 mb-2 ${
                      isCompleted
                        ? "bg-[hsl(var(--success))] text-white"
                        : isCurrent
                        ? "bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground border-2 border-border"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`text-xs font-heading font-medium text-center hidden sm:block ${
                    isCurrent ? "text-primary" : isCompleted ? "text-[hsl(var(--success))]" : "text-muted-foreground"
                  }`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Step Title */}
        <div className="sm:hidden text-center mb-6">
          <p className="text-sm font-heading font-semibold text-primary">
            Step {currentStep}: {STEPS[currentStep - 1].title}
          </p>
        </div>

        {/* Form Card */}
        <Card className="border-0 shadow-xl bg-card rounded-2xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="animate-fade-in-up">
              {currentStep === 1 && (
                <BasicInfoStep
                  formData={basicInfo}
                  onUpdate={(data) => setBasicInfo((prev) => ({ ...prev, ...data }))}
                  consents={consents}
                  onConsentChange={handleConsentChange}
                  verificationStatus={verificationStatus}
                  onVerificationComplete={handleVerificationComplete}
                  onNext={() => setCurrentStep(2)}
                />
              )}

              {currentStep === 2 && (
                <PANVerificationStep
                  panNumber={panNumber}
                  onPanChange={setPanNumber}
                  onVerified={handlePanVerified}
                  onNext={() => setCurrentStep(3)}
                  onBack={() => setCurrentStep(1)}
                  isVerified={panVerified}
                  verifiedData={panData}
                />
              )}

              {currentStep === 3 && (
                <AadhaarVerificationStep
                  aadhaarNumber={aadhaarNumber}
                  onAadhaarChange={setAadhaarNumber}
                  onVerified={handleAadhaarVerified}
                  onNext={() => setCurrentStep(4)}
                  onBack={() => setCurrentStep(2)}
                  isVerified={aadhaarVerified}
                  verifiedData={aadhaarData}
                />
              )}

              {currentStep === 4 && (
                <VideoKYCStep
                  onComplete={handleVideoKycComplete}
                  onBack={() => setCurrentStep(3)}
                  isCompleted={videoKycCompleted}
                  applicantName={basicInfo.name}
                />
              )}

              {submitting && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <span className="text-muted-foreground font-body text-lg">Submitting your application...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center flex items-center justify-center gap-2 text-sm text-muted-foreground font-body">
          <Shield className="h-4 w-4" />
          <span>Your data is 256-bit encrypted and secure</span>
        </div>
      </main>
    </div>
  );
}
