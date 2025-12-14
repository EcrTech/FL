import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BasicInfoStep } from "@/components/ReferralApplication/BasicInfoStep";
import { PANVerificationStep } from "@/components/ReferralApplication/PANVerificationStep";
import { AadhaarVerificationStep } from "@/components/ReferralApplication/AadhaarVerificationStep";
import { VideoKYCStep } from "@/components/ReferralApplication/VideoKYCStep";
import { FeatureHighlights } from "@/components/ReferralApplication/FeatureHighlights";
import { HeroSection } from "@/components/ReferralApplication/HeroSection";
import logo from "@/assets/paisaa-saarthi-new-logo.png";

interface ReferrerInfo {
  name: string;
  email: string;
  phone: string;
  orgId: string;
  userId: string;
}

const STEPS = [
  { id: 1, title: "Basic Info", description: "Personal details & consent" },
  { id: 2, title: "PAN Verification", description: "Verify your PAN card" },
  { id: 3, title: "Aadhaar Verification", description: "Verify your Aadhaar" },
  { id: 4, title: "Video KYC", description: "Complete video verification" },
];

export default function ReferralLoanApplication() {
  const { referralCode } = useParams<{ referralCode: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);

  // Form data
  const [basicInfo, setBasicInfo] = useState({
    name: "",
    email: "",
    phone: "",
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
          .select(`
            user_id,
            profiles:user_id (
              first_name,
              last_name,
              org_id
            )
          `)
          .eq("referral_code", referralCode)
          .eq("is_active", true)
          .single();

        if (fetchError || !data) {
          setError("Invalid or expired referral link");
          setLoading(false);
          return;
        }

        const profile = data.profiles as any;
        setReferrerInfo({
          name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
          email: "",
          phone: "",
          orgId: profile.org_id,
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

  const handleVideoKycComplete = () => {
    setVideoKycCompleted(true);
    submitApplication();
  };

  const submitApplication = async () => {
    setSubmitting(true);
    try {
      const applicationData = {
        applicant: {
          name: basicInfo.name,
          email: basicInfo.email,
          phone: basicInfo.phone,
          pan: panNumber,
          panVerified,
          panName: panData?.name,
          aadhaar: aadhaarNumber,
          aadhaarVerified,
          aadhaarName: aadhaarData?.name,
          aadhaarAddress: aadhaarData?.address,
          aadhaarDob: aadhaarData?.dob,
          videoKycCompleted,
        },
        consents,
        referrerInfo,
        referralCode,
      };

      const { data, error: submitError } = await supabase.functions.invoke("submit-loan-application", {
        body: applicationData,
      });

      if (submitError) throw submitError;

      setApplicationNumber(data?.applicationNumber || `APP-${Date.now()}`);
      toast.success("Application submitted successfully!");
    } catch (err: any) {
      console.error("Error submitting application:", err);
      toast.error(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Invalid Referral Link</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (applicationNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Application Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Your loan application has been successfully submitted. Our team will review your application and contact you shortly.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Application Number</p>
              <p className="text-xl font-bold text-primary">{applicationNumber}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <img src={logo} alt="Paisaa Saarthi" className="h-10 md:h-12" />
          <div className="text-sm text-muted-foreground hidden md:block">
            Step {currentStep} of {STEPS.length}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Form Section */}
        <div className="flex-1 lg:w-[55%] order-2 lg:order-1">
          <div className="max-w-xl mx-auto p-6 lg:p-12">
            {/* Progress */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  Step {currentStep}: {STEPS[currentStep - 1].title}
                </span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">
                {STEPS[currentStep - 1].description}
              </p>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-8">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      currentStep > step.id
                        ? "bg-green-500 text-white"
                        : currentStep === step.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.id ? <CheckCircle className="h-4 w-4" /> : step.id}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-8 md:w-16 h-0.5 mx-1 ${
                        currentStep > step.id ? "bg-green-500" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Form Card */}
            <Card className="border-border shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{STEPS[currentStep - 1].title}</CardTitle>
              </CardHeader>
              <CardContent>
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
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Submitting application...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hero Section */}
        <div className="lg:w-[45%] order-1 lg:order-2 h-64 lg:h-auto">
          <HeroSection referrerName={referrerInfo?.name} />
        </div>
      </div>

      {/* Feature Highlights */}
      <FeatureHighlights />
    </div>
  );
}
