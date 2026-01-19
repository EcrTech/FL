import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, Loader2 } from "lucide-react";

export default function DigilockerFailure() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const applicationId = searchParams.get("applicationId");
  const reason = searchParams.get("reason") || "Verification was cancelled or failed";
  const source = searchParams.get("source"); // Check if coming from referral form

  // Check if this is a referral form callback
  const isReferralCallback = source === "referral";
  const referralContext = isReferralCallback 
    ? JSON.parse(localStorage.getItem("referral_aadhaar_pending") || "null")
    : null;

  useEffect(() => {
    // If this is a referral callback, redirect back to the referral form
    if (isReferralCallback && referralContext?.returnUrl) {
      localStorage.removeItem("referral_aadhaar_pending");
      const returnUrl = new URL(referralContext.returnUrl);
      returnUrl.searchParams.set("digilocker_failure", "true");
      window.location.href = returnUrl.toString();
    }
  }, [isReferralCallback, referralContext]);

  const handleRetry = () => {
    if (applicationId) {
      navigate(`/los/applications/${applicationId}`);
    } else {
      navigate("/los/applications");
    }
  };

  // If redirecting to referral form, show loading state
  if (isReferralCallback && referralContext?.returnUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <CardTitle>Verification Incomplete</CardTitle>
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
          <div className="mx-auto mb-4">
            <XCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-destructive">Verification Failed</CardTitle>
          <CardDescription>
            Your Aadhaar verification via DigiLocker was not completed
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 bg-destructive/10 rounded-lg text-center">
            <p className="text-sm text-destructive">{reason}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              You can retry the verification from the application page.
            </p>
          </div>

          <Button onClick={handleRetry} className="w-full">
            Return to Application
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
