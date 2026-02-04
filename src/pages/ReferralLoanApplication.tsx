import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, Shield, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ApplicationHeader } from "@/components/ReferralApplication/ApplicationHeader";
import { StepProgressBar } from "@/components/ReferralApplication/StepProgressBar";
import { LoanRequirementsScreen } from "@/components/ReferralApplication/LoanRequirementsScreen";
import { ContactConsentScreen } from "@/components/ReferralApplication/ContactConsentScreen";
import { PANVerificationStep } from "@/components/ReferralApplication/PANVerificationStep";
import { AadhaarVerificationStep } from "@/components/ReferralApplication/AadhaarVerificationStep";
import { VideoKYCStep } from "@/components/ReferralApplication/VideoKYCStep";
import { useAnalytics } from "@/hooks/useAnalytics";

interface ReferrerInfo {
  name: string;
  email: string;
  phone: string;
  orgId: string;
  userId: string;
  referralCode: string;
}

// Main application steps (PAN = step 2, etc)
// Within step 1, we have 2 sub-screens: LoanRequirements and ContactConsent

// Storage key for persisting form state across DigiLocker redirects
const REFERRAL_FORM_STORAGE_KEY = "referral_form_state";

interface StoredFormState {
  currentStep: number;
  basicInfo: {
    name: string;
    email: string;
    officeEmail: string;
    phone: string;
    requestedAmount: number;
    tenureDays: number;
  };
  consents: {
    householdIncome: boolean;
    termsAndConditions: boolean;
    aadhaarConsent: boolean;
  };
  verificationStatus: {
    emailVerified: boolean;
    phoneVerified: boolean;
    officeEmailVerified: boolean;
  };
  panNumber: string;
  panVerified: boolean;
  panData?: { name: string; status: string; dob?: string };
  aadhaarNumber: string;
  aadhaarVerified: boolean;
  aadhaarData?: { 
    name: string; 
    address: string; 
    dob: string;
    gender?: string;
    aadhaarNumber?: string;
    addressData?: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      pincode: string;
    };
  };
  geolocation?: { latitude: number; longitude: number; accuracy: number };
  referralCode?: string;
}

export default function ReferralLoanApplication() {
  // Debug: Component mount logging
  console.log('[ReferralLoanApplication] Component mounting at', new Date().toISOString());
  
  const { referralCode } = useParams<{ referralCode: string }>();
  const { trackStep, trackFormStart, trackConversion, trackVideoKYC, trackMetaEvent } = useAnalytics();
  
  // Debug: Log referral code and environment
  console.log('[ReferralLoanApplication] URL referralCode param:', referralCode);
  
  const [currentStep, setCurrentStep] = useState(1);
  // Sub-step within Step 1: 1 = LoanRequirements, 2 = ContactConsent
  const [basicInfoSubStep, setBasicInfoSubStep] = useState<1 | 2>(1);
  const [referrerInfo, setReferrerInfo] = useState<ReferrerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [draftApplicationId, setDraftApplicationId] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [geolocation, setGeolocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [stateRestored, setStateRestored] = useState(false);

  // Capture geolocation function
  const captureGeolocation = () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeolocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationLoading(false);
        setLocationError(null);
      },
      (error) => {
        console.warn("Geolocation error:", error.message);
        let errorMessage = "Failed to capture location";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable location permissions in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Location information is unavailable";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Location request timed out. Please try again.";
        }
        setLocationError(errorMessage);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Capture geolocation on mount
  useEffect(() => {
    captureGeolocation();
  }, []);

  // Form data
  const [basicInfo, setBasicInfo] = useState({
    name: "",
    email: "",
    officeEmail: "",
    phone: "",
    requestedAmount: 25000,  // Match UI default
    tenureDays: 30,          // Match UI default
  });

  const [consents, setConsents] = useState({
    householdIncome: false,
    termsAndConditions: false,
    aadhaarConsent: false,
  });

  const [verificationStatus, setVerificationStatus] = useState({
    emailVerified: false,
    phoneVerified: false,
    officeEmailVerified: false,
  });

  const [panNumber, setPanNumber] = useState("");
  const [panVerified, setPanVerified] = useState(false);
  const [panData, setPanData] = useState<{ name: string; status: string; dob?: string } | undefined>();

  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarData, setAadhaarData] = useState<{ 
    name: string; 
    address: string; 
    dob: string; 
    aadhaarNumber?: string;
    gender?: string;
    addressData?: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      pincode: string;
    };
  } | undefined>();

  const [videoKycCompleted, setVideoKycCompleted] = useState(false);

  // Restore form state from localStorage on mount (for DigiLocker redirect return)
  useEffect(() => {
    const storedState = localStorage.getItem(REFERRAL_FORM_STORAGE_KEY);
    if (storedState) {
      try {
        const parsed: StoredFormState = JSON.parse(storedState);
        // Only restore if same referral code
        if (parsed.referralCode === referralCode) {
          console.log('[ReferralLoanApplication] Restoring form state from localStorage');
          setCurrentStep(parsed.currentStep);
          setBasicInfo(parsed.basicInfo);
          setConsents(parsed.consents);
          setVerificationStatus(parsed.verificationStatus);
          setPanNumber(parsed.panNumber);
          setPanVerified(parsed.panVerified);
          if (parsed.panData) setPanData(parsed.panData);
          setAadhaarNumber(parsed.aadhaarNumber);
          setAadhaarVerified(parsed.aadhaarVerified);
          if (parsed.aadhaarData) setAadhaarData(parsed.aadhaarData);
          if (parsed.geolocation) setGeolocation(parsed.geolocation);
        } else {
          console.log('[ReferralLoanApplication] Stored state is for different referral code, clearing');
          localStorage.removeItem(REFERRAL_FORM_STORAGE_KEY);
        }
      } catch (e) {
        console.error('[ReferralLoanApplication] Failed to restore form state:', e);
        localStorage.removeItem(REFERRAL_FORM_STORAGE_KEY);
      }
    }
    setStateRestored(true);
  }, [referralCode]);

  // Persist form state to localStorage whenever key fields change
  useEffect(() => {
    // Only save after initial state restoration and if we have meaningful data
    if (!stateRestored) return;
    if (currentStep > 1 || panNumber || aadhaarNumber) {
      const state: StoredFormState = {
        currentStep,
        basicInfo,
        consents,
        verificationStatus,
        panNumber,
        panVerified,
        panData,
        aadhaarNumber,
        aadhaarVerified,
        aadhaarData,
        geolocation: geolocation || undefined,
        referralCode,
      };
      localStorage.setItem(REFERRAL_FORM_STORAGE_KEY, JSON.stringify(state));
      console.log('[ReferralLoanApplication] Form state saved to localStorage');
    }
  }, [stateRestored, currentStep, basicInfo, consents, verificationStatus, panNumber, panVerified, panData, aadhaarNumber, aadhaarVerified, aadhaarData, geolocation, referralCode]);

  // Fetch referrer info
  useEffect(() => {
    console.log('[ReferralLoanApplication] useEffect triggered for fetchReferrerInfo');
    
    async function fetchReferrerInfo() {
      console.log('[ReferralLoanApplication] fetchReferrerInfo() called');
      console.log('[ReferralLoanApplication] referralCode value:', referralCode);
      
      if (!referralCode) {
        console.log('[ReferralLoanApplication] No referralCode - setting error');
        setError("Invalid referral link");
        setLoading(false);
        return;
      }

      try {
        console.log('[ReferralLoanApplication] Starting Supabase query for referral code:', referralCode);
        console.time('[ReferralLoanApplication] Supabase query duration');
        
        const { data, error: fetchError } = await supabase
          .from("user_referral_codes")
          .select("user_id, org_id")
          .eq("referral_code", referralCode)
          .eq("is_active", true)
          .single();

        console.timeEnd('[ReferralLoanApplication] Supabase query duration');
        console.log('[ReferralLoanApplication] Supabase response - data:', data);
        console.log('[ReferralLoanApplication] Supabase response - error:', fetchError);

        if (fetchError || !data) {
          console.error('[ReferralLoanApplication] Query failed:', fetchError?.message, fetchError?.code);
          setError("Invalid or expired referral link");
          setLoading(false);
          return;
        }

        console.log('[ReferralLoanApplication] Setting referrerInfo with orgId:', data.org_id, 'userId:', data.user_id);
        setReferrerInfo({
          name: "Your Loan Advisor",
          email: "",
          phone: "",
          orgId: data.org_id,
          userId: data.user_id,
          referralCode: referralCode,
        });
      } catch (err) {
        console.error('[ReferralLoanApplication] Exception in fetchReferrerInfo:', err);
        setError("Failed to load referral information");
      } finally {
        console.log('[ReferralLoanApplication] Setting loading to false');
        setLoading(false);
      }
    }

    fetchReferrerInfo();
  }, [referralCode]);

  // Debug: State monitoring
  useEffect(() => {
    console.log('[ReferralLoanApplication] State changed:', {
      loading,
      error,
      hasReferrerInfo: !!referrerInfo,
      referrerInfoOrgId: referrerInfo?.orgId,
      currentStep,
    });
  }, [loading, error, referrerInfo, currentStep]);

  const handleVerificationComplete = (type: 'email' | 'phone' | 'officeEmail') => {
    setVerificationStatus((prev) => ({
      ...prev,
      [type === 'email' ? 'emailVerified' : type === 'phone' ? 'phoneVerified' : 'officeEmailVerified']: true,
    }));
  };

  const handleConsentChange = (consent: 'householdIncome' | 'termsAndConditions' | 'aadhaarConsent', value: boolean) => {
    setConsents((prev) => ({ ...prev, [consent]: value }));
  };

  const handlePanVerified = (data: { name: string; status: string; dob?: string }) => {
    setPanData(data);
    setPanVerified(true);
  };

  const handleAadhaarVerified = (data: { 
    name: string; 
    address: string; 
    dob: string; 
    aadhaarNumber?: string;
    gender?: string;
    addressData?: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      pincode: string;
    };
  }) => {
    setAadhaarData(data);
    setAadhaarVerified(true);
    // Store aadhaar number if provided from DigiLocker
    if (data.aadhaarNumber) {
      setAadhaarNumber(data.aadhaarNumber);
    }
  };

  // Create draft application before entering Video KYC step using edge function (bypasses RLS)
  const createDraftApplication = async (): Promise<string | null> => {
    if (!referrerInfo) {
      toast.error("Referrer information not available");
      return null;
    }

    setCreatingDraft(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-draft-referral-application', {
        body: {
          referralCode: referrerInfo.referralCode,
          basicInfo: {
            name: basicInfo.name,
            phone: basicInfo.phone,
            email: basicInfo.email,
            requestedAmount: basicInfo.requestedAmount,
            tenureDays: basicInfo.tenureDays,
          },
          panNumber,
          aadhaarNumber,
          aadhaarData,
          panData,
        }
      });

      if (error) {
        console.error("Error creating draft application:", error);
        toast.error("Failed to prepare application. Please try again.");
        return null;
      }

      if (!data?.success || !data?.draftId) {
        console.error("Invalid response from draft creation:", data);
        toast.error(data?.error || "Failed to prepare application. Please try again.");
        return null;
      }

      console.log("Draft application created:", data.draftId);
      return data.draftId;
    } catch (err) {
      console.error("Error creating draft:", err);
      toast.error("Failed to prepare application. Please try again.");
      return null;
    } finally {
      setCreatingDraft(false);
    }
  };

  // Handle entering Video KYC step
  const handleEnterVideoStep = async () => {
    // Track step 4 - Video KYC
    trackStep(4, 'video_kyc', 'referral');
    
    // Create draft application to get ID for video upload
    const appId = await createDraftApplication();
    if (appId) {
      setDraftApplicationId(appId);
      setCurrentStep(4);
    }
  };

  const handleVideoKycComplete = async () => {
    // Final check for geolocation before submission
    if (!geolocation) {
      toast.error("Location is required to submit the application. Please enable location access.");
      return;
    }
    
    // Track Video KYC completion (primary Google Ads conversion)
    if (draftApplicationId) {
      trackVideoKYC(draftApplicationId);
    }
    
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
        officeEmail: basicInfo.officeEmail || null,
        officeEmailVerified: verificationStatus.officeEmailVerified,
        phone: basicInfo.phone,
        requestedAmount: basicInfo.requestedAmount,
        tenureDays: basicInfo.tenureDays,
        pan: panNumber,
        panVerified,
        panName: panData?.name,
        panDob: panData?.dob,
        aadhaar: aadhaarNumber,
        aadhaarVerified,
        aadhaarName: aadhaarData?.name,
        aadhaarAddress: aadhaarData?.address,
        aadhaarDob: aadhaarData?.dob,
        aadhaarGender: aadhaarData?.gender,
        addressData: aadhaarData?.addressData,
        videoKycCompleted: true,
      },
        consents,
        referrerInfo,
        referralCode,
        geolocation,
        draftApplicationId, // Include the draft ID so the edge function can update it
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
      
      // Track final conversion - Purchase event
      trackConversion(
        data?.applicationNumber || draftApplicationId || 'unknown',
        basicInfo.requestedAmount,
        'referral'
      );
      
      // Clear saved form state after successful submission
      localStorage.removeItem(REFERRAL_FORM_STORAGE_KEY);
      console.log('[ReferralLoanApplication] Form state cleared from localStorage after submission');
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

  // Determine if we should show back button in header
  const showHeaderBack = currentStep === 1 && basicInfoSubStep === 2;

  // Handle back navigation
  const handleHeaderBack = () => {
    if (currentStep === 1 && basicInfoSubStep === 2) {
      setBasicInfoSubStep(1);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--referral-bg))]">
      {/* Header */}
      <ApplicationHeader
        showBack={showHeaderBack}
        onBack={handleHeaderBack}
        locationLoading={locationLoading}
        hasLocation={!!geolocation}
      />

      {/* Progress Stepper */}
      <StepProgressBar currentStep={currentStep} />

      {/* Location Error Alert */}
      {!locationLoading && !geolocation && (
        <div className="px-4 pb-2">
          <div className="max-w-lg mx-auto flex flex-col items-center gap-2 p-3 bg-destructive/10 rounded-xl border border-destructive/20">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{locationError || "Location required"}</span>
            </div>
            <button
              onClick={captureGeolocation}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-lg mx-auto">
        {/* Step 1: Basic Info (2 sub-screens) */}
        {currentStep === 1 && (
          <div className="relative overflow-hidden">
            {basicInfoSubStep === 1 && (
              <div className="animate-fade-in-up">
                <LoanRequirementsScreen
                  formData={{
                    name: basicInfo.name,
                    requestedAmount: basicInfo.requestedAmount,
                    phone: basicInfo.phone,
                  }}
                  onUpdate={(data) => setBasicInfo((prev) => ({ ...prev, ...data }))}
                  consents={consents}
                  onConsentChange={handleConsentChange}
                  verificationStatus={{ phoneVerified: verificationStatus.phoneVerified }}
                  onVerificationComplete={() => handleVerificationComplete('phone')}
                  onContinue={() => setBasicInfoSubStep(2)}
                />
              </div>
            )}
            
            {basicInfoSubStep === 2 && (
              <div className="animate-slide-in-right">
                <ContactConsentScreen
                  formData={{
                    email: basicInfo.email,
                    officeEmail: basicInfo.officeEmail,
                    tenureDays: basicInfo.tenureDays,
                  }}
                  onUpdate={(data) => setBasicInfo((prev) => ({ ...prev, ...data }))}
                  verificationStatus={{
                    emailVerified: verificationStatus.emailVerified,
                    officeEmailVerified: verificationStatus.officeEmailVerified,
                  }}
                  onVerificationComplete={handleVerificationComplete}
                  onContinue={() => setCurrentStep(2)}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2: PAN Verification */}
        {currentStep === 2 && (
          <div className="px-4 py-4">
            <Card className="border-0 shadow-lg bg-card rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <PANVerificationStep
                  panNumber={panNumber}
                  onPanChange={setPanNumber}
                  onVerified={handlePanVerified}
                  onNext={() => setCurrentStep(3)}
                  onBack={() => {
                    setCurrentStep(1);
                    setBasicInfoSubStep(2);
                  }}
                  isVerified={panVerified}
                  verifiedData={panData}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Aadhaar Verification */}
        {currentStep === 3 && (
          <div className="px-4 py-4">
            <Card className="border-0 shadow-lg bg-card rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <AadhaarVerificationStep
                  onVerified={handleAadhaarVerified}
                  onNext={handleEnterVideoStep}
                  onBack={() => setCurrentStep(2)}
                  isVerified={aadhaarVerified}
                  verifiedData={aadhaarData}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Creating Draft Loader */}
        {creatingDraft && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <span className="text-muted-foreground font-body text-lg">Preparing Video KYC...</span>
          </div>
        )}

        {/* Step 4: Video KYC */}
        {currentStep === 4 && !creatingDraft && (
          <div className="px-4 py-4">
            <Card className="border-0 shadow-lg bg-card rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <VideoKYCStep
                  onComplete={handleVideoKycComplete}
                  onBack={() => setCurrentStep(3)}
                  isCompleted={videoKycCompleted}
                  applicantName={basicInfo.name}
                  applicationId={draftApplicationId || undefined}
                  orgId={referrerInfo?.orgId}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Submitting Loader */}
        {submitting && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <span className="text-muted-foreground font-body text-lg">Submitting your application...</span>
          </div>
        )}
      </main>

      {/* Footer */}
      <div className="py-6 text-center flex items-center justify-center gap-2 text-xs text-muted-foreground font-body">
        <Shield className="h-3.5 w-3.5" />
        <span>Your data is 256-bit encrypted and secure</span>
      </div>
    </div>
  );
}
