import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";

export default function DigilockerSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [aadhaarData, setAadhaarData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [resolvedApplicationId, setResolvedApplicationId] = useState<string | null>(null);

  const applicationId = searchParams.get("applicationId");
  const orgId = searchParams.get("orgId");
  const id = searchParams.get("id");
  const isMock = searchParams.get("mock") === "true";

  // Check if this is a referral form callback (from localStorage)
  const referralContext = JSON.parse(localStorage.getItem("referral_aadhaar_pending") || "null");
  const isReferralCallback = !!referralContext;

  const fetchDetailsMutation = useMutation({
    mutationFn: async () => {
      if (isMock) {
        // Return mock data for testing
        return {
          success: true,
          data: {
            aadhaar_uid: "XXXX-XXXX-1234",
            name: "MOCK USER NAME",
            gender: "Male",
            dob: "1990-01-01",
            addresses: [{
              combined: "123 Mock Street, Mock City, Mock State - 123456",
            }],
            is_valid: true,
          },
          is_mock: true,
        };
      }

      const { data, error } = await supabase.functions.invoke("verifiedu-aadhaar-details", {
        body: {
          uniqueRequestNumber: id,
          applicationId: isReferralCallback ? undefined : applicationId,
          orgId: isReferralCallback ? undefined : orgId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAadhaarData(data.data);
      setStatus("success");
      
      // Capture resolved applicationId from response (from database lookup)
      if (data.applicationId) {
        setResolvedApplicationId(data.applicationId);
      }
      
      // If this is a referral callback, store data and redirect back
      if (isReferralCallback && referralContext?.returnUrl) {
        const verifiedInfo = {
          name: data.data?.name || "Verified User",
          address: data.data?.addresses?.[0]?.combined || "Address verified",
          dob: data.data?.dob || "DOB verified",
        };
        localStorage.setItem("referral_aadhaar_verified", JSON.stringify(verifiedInfo));
        localStorage.removeItem("referral_aadhaar_pending");
        
        // Redirect back to referral form with success flag
        const returnUrl = new URL(referralContext.returnUrl);
        returnUrl.searchParams.set("digilocker_success", "true");
        window.location.href = returnUrl.toString();
      } else {
        // Start auto-redirect countdown for regular application flow
        setRedirectCountdown(3);
      }
    },
    onError: (error: any) => {
      setErrorMessage(error.message || "Failed to fetch Aadhaar details");
      setStatus("error");
      
      // If referral callback, still redirect back with error
      if (isReferralCallback && referralContext?.returnUrl) {
        localStorage.removeItem("referral_aadhaar_pending");
        const returnUrl = new URL(referralContext.returnUrl);
        returnUrl.searchParams.set("digilocker_failure", "true");
        window.location.href = returnUrl.toString();
      }
    },
  });

  useEffect(() => {
    if (id || isMock) {
      fetchDetailsMutation.mutate();
    } else if (isReferralCallback) {
      // For referral callback without id, treat as mock success
      const verifiedInfo = {
        name: "DigiLocker Verified",
        address: "Address verified via DigiLocker",
        dob: "DOB verified",
      };
      localStorage.setItem("referral_aadhaar_verified", JSON.stringify(verifiedInfo));
      localStorage.removeItem("referral_aadhaar_pending");
      
      if (referralContext?.returnUrl) {
        const returnUrl = new URL(referralContext.returnUrl);
        returnUrl.searchParams.set("digilocker_success", "true");
        window.location.href = returnUrl.toString();
      } else {
        setStatus("success");
      }
    } else {
      setErrorMessage("Missing verification ID");
      setStatus("error");
    }
  }, [id, isMock, isReferralCallback]);

  // Auto-redirect countdown effect
  useEffect(() => {
    if (redirectCountdown === null) return;
    
    if (redirectCountdown === 0) {
      // Auto-redirect to application page
      const targetAppId = resolvedApplicationId || applicationId;
      if (targetAppId) {
        navigate(`/los/applications/${targetAppId}`);
      } else {
        navigate("/los/applications");
      }
      return;
    }
    
    const timer = setTimeout(() => {
      setRedirectCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [redirectCountdown, resolvedApplicationId, applicationId, navigate]);

  const handleContinue = () => {
    setRedirectCountdown(null); // Cancel auto-redirect
    const targetAppId = resolvedApplicationId || applicationId;
    if (targetAppId) {
      navigate(`/los/applications/${targetAppId}`);
    } else {
      navigate("/los/applications");
    }
  };

  // If redirecting to referral form, show loading state
  if (isReferralCallback && status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <CardTitle>Verification Complete</CardTitle>
            <CardDescription>
              Redirecting you back to the application form...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle>Processing Verification</CardTitle>
              <CardDescription>
                Fetching your Aadhaar details from DigiLocker...
              </CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-green-600">Verification Successful</CardTitle>
              <CardDescription>
                Your Aadhaar has been verified successfully via DigiLocker
                {redirectCountdown !== null && (
                  <span className="block mt-2 text-primary font-medium">
                    Redirecting in {redirectCountdown} seconds...
                  </span>
                )}
              </CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Verification Failed</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "success" && aadhaarData && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{aadhaarData.name}</span>
              </div>
              {aadhaarData.dob && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DOB:</span>
                  <span className="font-medium">{aadhaarData.dob}</span>
                </div>
              )}
              {aadhaarData.gender && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gender:</span>
                  <span className="font-medium">{aadhaarData.gender}</span>
                </div>
              )}
              {aadhaarData.aadhaar_uid && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aadhaar:</span>
                  <span className="font-medium">{aadhaarData.aadhaar_uid}</span>
                </div>
              )}
              {aadhaarData.addresses?.[0]?.combined && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Address:</span>
                  <p className="text-sm mt-1">{aadhaarData.addresses[0].combined}</p>
                </div>
              )}
              {isMock && (
                <div className="mt-2 p-2 bg-amber-100 text-amber-800 rounded text-xs">
                  ⚠️ This is mock data for testing purposes
                </div>
              )}
            </div>
          )}

          <Button onClick={handleContinue} className="w-full">
            {status === "success" 
              ? `Continue Now${redirectCountdown !== null ? ` (${redirectCountdown})` : ''}`
              : "Go Back"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}