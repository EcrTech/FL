import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, User, CreditCard, FileCheck, Video, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BasicInfoStep } from "@/components/ReferralApplication/BasicInfoStep";
import { PANVerificationStep } from "@/components/ReferralApplication/PANVerificationStep";
import { AadhaarVerificationStep } from "@/components/ReferralApplication/AadhaarVerificationStep";
import { VideoKYCStep } from "@/components/ReferralApplication/VideoKYCStep";
import logo from "@/assets/paisaa-saarthi-new-logo.png";

interface ReferrerInfo {
  name: string;
  email: string;
  phone: string;
  orgId: string;
  userId: string;
}

const STEPS = [
  { id: 1, title: "Personal Details", description: "Basic information", icon: User },
  { id: 2, title: "PAN Verification", description: "Income tax validation", icon: CreditCard },
  { id: 3, title: "Aadhaar Verification", description: "eKYC via UIDAI", icon: FileCheck },
  { id: 4, title: "Video KYC", description: "Identity verification", icon: Video },
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
        <Card className="max-w-md w-full shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold mb-3">Invalid Referral Link</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (applicationNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
        <Card className="max-w-md w-full shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Application Submitted!</h2>
            <p className="text-muted-foreground mb-8">
              Your loan application has been successfully submitted. Our team will review your application and contact you shortly.
            </p>
            <div className="bg-primary/5 p-6 rounded-xl border border-primary/10">
              <p className="text-sm text-muted-foreground mb-1">Application Number</p>
              <p className="text-2xl font-bold text-primary">{applicationNumber}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Top Gradient Bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-accent" />
      
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Paisaa Saarthi" className="h-10" />
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="/" 
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Home</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Title Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Loan Application
          </h1>
          <p className="text-muted-foreground text-lg">
            Complete the following steps to submit your application
          </p>
          {referrerInfo?.name && (
            <div className="inline-flex items-center gap-2 mt-4 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              Referred by {referrerInfo.name}
            </div>
          )}
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center gap-0">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isCompleted
                          ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                          : isCurrent
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground border-2 border-border"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="mt-3 text-center hidden md:block">
                      <p className={`text-sm font-medium ${isCurrent ? "text-primary" : "text-foreground"}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-12 md:w-20 h-0.5 mx-2 transition-colors duration-300 ${
                        isCompleted ? "bg-green-500" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Step Title */}
        <div className="md:hidden text-center mb-6">
          <p className="text-sm font-medium text-primary">
            Step {currentStep}: {STEPS[currentStep - 1].title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {STEPS[currentStep - 1].description}
          </p>
        </div>

        {/* Form Card */}
        <Card className="border-0 shadow-xl bg-card">
          <CardContent className="p-6 md:p-10">
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
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <span className="text-muted-foreground">Submitting your application...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Your information is secure and encrypted. We'll never share your data without your consent.
          </p>
        </div>
      </main>
    </div>
  );
}
