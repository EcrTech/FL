import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, RefreshCw, AlertCircle } from "lucide-react";
import { LoanDetailsStep } from "@/components/PublicLoanApplication/LoanDetailsStep";
import { PersonalDetailsStep } from "@/components/PublicLoanApplication/PersonalDetailsStep";
import { AddressDetailsStep } from "@/components/PublicLoanApplication/AddressDetailsStep";
import { EmploymentDetailsStep } from "@/components/PublicLoanApplication/EmploymentDetailsStep";
import { DocumentUploadStep } from "@/components/PublicLoanApplication/DocumentUploadStep";
import { ReviewStep } from "@/components/PublicLoanApplication/ReviewStep";
import { ConsentOTPStep } from "@/components/PublicLoanApplication/ConsentOTPStep";
import { SuccessScreen } from "@/components/PublicLoanApplication/SuccessScreen";
import { useAnalytics } from "@/hooks/useAnalytics";

export interface LoanFormData {
  loanDetails: {
    productType: string;
    amount: string;
    tenure: number;
  };
  personalDetails: {
    fullName: string;
    dob: string;
    gender: string;
    maritalStatus: string;
    panNumber: string;
    aadhaarNumber: string;
    mobile: string;
    email: string;
    fatherName: string;
  };
  addressDetails: {
    currentAddress: {
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      pincode: string;
    };
    permanentAddress: {
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      pincode: string;
    };
    sameAsCurrent: boolean;
    residenceType: string;
  };
  employmentDetails: {
    employmentType: string;
    employerName: string;
    employerType: string;
    designation: string;
    grossSalary: string;
    netSalary: string;
    bankName: string;
    accountNumber: string;
  };
  documents: Array<{
    type: string;
    file: File | null;
    base64: string;
    name: string;
    mimeType: string;
  }>;
}

interface FormConfig {
  id: string;
  name: string;
  description: string;
  product_type: string;
  required_documents: string[];
}

const STEPS = [
  { id: 1, name: "Loan Details" },
  { id: 2, name: "Personal Info" },
  { id: 3, name: "Address" },
  { id: 4, name: "Employment" },
  { id: 5, name: "Documents" },
  { id: 6, name: "Review" },
  { id: 7, name: "Consent" },
];

const initialFormData: LoanFormData = {
  loanDetails: {
    productType: "",
    amount: "",
    tenure: 7,
  },
  personalDetails: {
    fullName: "",
    dob: "",
    gender: "",
    maritalStatus: "",
    panNumber: "",
    aadhaarNumber: "",
    mobile: "",
    email: "",
    fatherName: "",
  },
  addressDetails: {
    currentAddress: {
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
    },
    permanentAddress: {
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
    },
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

export default function PublicLoanApplication() {
  const { slug } = useParams<{ slug: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [geolocation, setGeolocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [formStartTime] = useState(Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  
  const { trackStep, trackConversion, trackMetaEvent } = useAnalytics();

  useEffect(() => {
    async function fetchFormConfig() {
      if (!slug) {
        setError("Invalid application link");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("loan_application_forms")
        .select("id, name, description, product_type, required_documents")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (fetchError || !data) {
        setError("This application form is not available");
        setLoading(false);
        return;
      }

      setFormConfig(data as FormConfig);
      setFormData(prev => ({
        ...prev,
        loanDetails: {
          ...prev.loanDetails,
          productType: data.product_type,
        },
      }));
      setLoading(false);
    }

    fetchFormConfig();
  }, [slug]);

  // Capture geolocation function
  const captureGeolocation = useCallback(() => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser. Please use a modern browser.");
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
        console.error("Geolocation error:", error);
        let errorMessage = "Unable to capture location. ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Please allow location access in your browser settings and try again.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable. Please try again.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out. Please try again.";
            break;
          default:
            errorMessage += "Please enable location permissions and try again.";
        }
        setLocationError(errorMessage);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, []);

  // Capture geolocation on mount
  useEffect(() => {
    captureGeolocation();
  }, [captureGeolocation]);

  const updateFormData = (section: keyof LoanFormData, data: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], ...data },
    }));
  };

  const saveDraftApplication = async () => {
    if (savingDraft) return;
    
    setSavingDraft(true);
    try {
      const response = await supabase.functions.invoke("save-draft-application", {
        body: {
          formSlug: slug,
          draftId,
          loanDetails: formData.loanDetails,
          personalDetails: formData.personalDetails,
          geolocation,
        },
      });

      if (response.data?.draftId) {
        setDraftId(response.data.draftId);
      }
    } catch (err) {
      console.error("Error saving draft:", err);
    } finally {
      setSavingDraft(false);
    }
  };

  const nextStep = async () => {
    // Guard: block step progression if location is not captured
    if (!geolocation) {
      toast.error("Please enable location access to continue");
      captureGeolocation();
      return;
    }

    if (currentStep < STEPS.length) {
      // Track step progression
      const stepNames = ['loan_details', 'personal_info', 'address', 'employment', 'documents', 'review', 'consent'];
      trackStep(currentStep + 1, stepNames[currentStep] || 'unknown', 'public');
      
      // Track Meta SubmitApplication on personal details completion
      if (currentStep === 2 && formData.personalDetails.fullName && formData.personalDetails.mobile) {
        trackMetaEvent('SubmitApplication', {
          content_name: 'Public Loan Application',
          value: parseFloat(formData.loanDetails.amount) || 0,
          currency: 'INR',
        });
        saveDraftApplication();
      }
      
      // Track CompleteRegistration on review step
      if (currentStep === 6) {
        trackMetaEvent('CompleteRegistration', {
          content_name: 'Public Loan Application Review',
          status: 'complete',
        });
      }
      
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

  const handleConsent = async (otpVerificationId: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("submit-loan-application", {
        body: {
          formSlug: slug,
          formStartTime,
          honeypot,
          draftId,
          consentOtpId: otpVerificationId,
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
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Submission failed");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setApplicationNumber(response.data.applicationNumber);
      
      // Track final conversion - Purchase event
      trackConversion(
        response.data.applicationNumber || draftId || 'unknown',
        parseFloat(formData.loanDetails.amount) || 0,
        'public'
      );
      
      setCurrentStep(8);
    } catch (err: any) {
      console.error("Submission error:", err);
      setError(err.message || "Failed to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !formConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold text-destructive mb-2">Form Not Available</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 8 && applicationNumber) {
    return <SuccessScreen applicationNumber={applicationNumber} />;
  }

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {formConfig?.name || "Loan Application"}
          </h1>
          {formConfig?.description && (
            <p className="text-muted-foreground">{formConfig.description}</p>
          )}
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => goToStep(step.id)}
                disabled={step.id > currentStep}
                className={`text-xs md:text-sm font-medium transition-colors ${
                  step.id === currentStep
                    ? "text-primary"
                    : step.id < currentStep
                    ? "text-primary/70 hover:text-primary cursor-pointer"
                    : "text-muted-foreground"
                }`}
              >
                <span className="hidden md:inline">{step.name}</span>
                <span className="md:hidden">{step.id}</span>
              </button>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ display: "none" }}
          tabIndex={-1}
          autoComplete="off"
        />

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Location Status Alert */}
        {!geolocation && !locationLoading && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Location Required</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{locationError || "Location access is required to submit this application."}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={captureGeolocation}
                className="w-fit"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Location Access
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {geolocation && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-green-600" />
            <span>Location captured successfully</span>
          </div>
        )}

        <Card>
          <CardContent className="p-6">
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
                requiredDocuments={formConfig?.required_documents || []}
                onChange={(docs) => setFormData(prev => ({ ...prev, documents: docs }))}
                onNext={nextStep}
                onPrev={prevStep}
                geolocation={geolocation}
              />
            )}
            {currentStep === 6 && (
              <ReviewStep
                formData={formData}
                onNext={nextStep}
                onPrev={prevStep}
                onEdit={goToStep}
              />
            )}
            {currentStep === 7 && (
              <ConsentOTPStep
                mobile={formData.personalDetails.mobile}
                onConsent={handleConsent}
                onPrev={prevStep}
                submitting={submitting}
              />
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your information is secure and encrypted. We do not share your data with third parties.
        </p>
      </div>
    </div>
  );
}
