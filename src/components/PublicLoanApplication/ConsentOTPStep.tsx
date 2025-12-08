import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Loader2, Send, ShieldCheck, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConsentOTPStepProps {
  mobile: string;
  onConsent: (otpVerificationId: string) => void;
  onPrev: () => void;
  submitting: boolean;
}

const TERMS_AND_CONDITIONS = `Consent and Terms for Loan Application

Thank you for applying for a loan with Paisaa Sarthi (the "Lender"). Please read the following terms and conditions carefully before providing your consent.

1. Information Sharing and Verification:
Paisaa Sarthi may share and verify all information provided by you, including personal, financial, and KYC data, with its group companies, banks, NBFCs, credit bureaus (such as CIBIL, Equifax), and statutory or regulatory authorities for the purpose of processing your loan application, credit assessment, fraud prevention, and reporting.

2. Credit Bureau and Data Usage:
You authorize Paisaa Sarthi to perform credit checks and share credit behavior data with credit bureaus. This may impact your credit score and record. You also consent to the usage of your data for loan processing, disbursement, and recovery purposes.

3. Digital Documentation and Electronic Signature:
You agree that all documents related to the loan application, sanction, disbursement, and repayment may be signed digitally using electronic signatures, and such digitally signed documents shall be considered legally valid and binding.

4. Consent for Communication:
You consent to receive communications, including OTPs, loan reminders, statements, and marketing offers, via SMS, email, phone calls, or other digital means from Paisaa Sarthi or authorized third parties.

5. Data Security and Privacy:
Paisaa Sarthi will use reasonable security measures to protect your data but is not liable for unauthorized access beyond its control. You may review the Privacy Policy on our website for detailed data handling practices.

6. Loan Terms and Repayment:
You agree to the loan amount, interest rates, fees, repayment schedule, and all terms stipulated in the sanction letter and loan agreement. Non-compliance may lead to recovery actions as per RBI guidelines.

7. No Liability Disclaimer:
Paisaa Sarthi shall not be liable for any loss or damage arising from information sharing or data verification, provided it has acted in good faith and compliance with applicable laws.

If you agree to all the above terms and conditions, please enter the OTP sent to your registered mobile number to provide your electronic consent.`;

export function ConsentOTPStep({ mobile, onConsent, onPrev, submitting }: ConsentOTPStepProps) {
  const [agreed, setAgreed] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Handle resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const maskedMobile = mobile ? `XXXXXX${mobile.slice(-4)}` : "";

  const handleSendOTP = async () => {
    if (!agreed) {
      toast.error("Please agree to the terms and conditions first");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("send-consent-otp", {
        body: { mobile },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to send OTP");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setOtpId(response.data.otpId);
      setOtpSent(true);
      setResendTimer(60);
      toast.success("OTP sent to your mobile number");
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setError(err.message || "Failed to send OTP. Please try again.");
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("verify-consent-otp", {
        body: { 
          otpId,
          otp,
          mobile 
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Verification failed");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.data?.success) {
        toast.success("Consent verified successfully!");
        onConsent(response.data.verificationId);
      } else {
        throw new Error("Verification failed");
      }
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      setError(err.message || "Invalid OTP. Please try again.");
      toast.error(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    await handleSendOTP();
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Consent & Verification</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Please read and agree to the terms, then verify with OTP
        </p>
      </div>

      {/* Terms and Conditions */}
      <div className="border rounded-lg">
        <div className="p-3 bg-muted/50 border-b">
          <h3 className="font-medium text-sm">Terms and Conditions</h3>
        </div>
        <ScrollArea className="h-48 p-4">
          <div className="text-sm text-muted-foreground whitespace-pre-line">
            {TERMS_AND_CONDITIONS}
          </div>
        </ScrollArea>
      </div>

      {/* Agreement Checkbox */}
      <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
        <Checkbox
          id="terms"
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
          disabled={otpSent}
        />
        <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
          I have read and agree to all the terms and conditions. I consent to the sharing and verification 
          of my information as described above.
        </Label>
      </div>

      {/* Consent Message */}
      {agreed && !otpSent && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <p className="text-blue-800 dark:text-blue-200">
            Thank you for applying for a loan from Paisaa Sarthi. Paisaa Sarthi may share and verify all 
            related information with its group companies, other banks, credit bureaus, and statutory 
            authorities without liability. If you agree to the terms, click "Send OTP" to receive a 
            verification code on your registered mobile number.
          </p>
        </div>
      )}

      {/* OTP Input Section */}
      {otpSent && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-sm">
            <p className="text-green-800 dark:text-green-200">
              OTP has been sent to your mobile number ending in <strong>{maskedMobile.slice(-4)}</strong>. 
              Please enter the 6-digit code below to provide your consent.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">Enter OTP</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              className="text-center text-lg tracking-widest"
            />
          </div>

          {/* Resend OTP */}
          <div className="text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-muted-foreground">
                Resend OTP in <span className="font-medium">{resendTimer}s</span>
              </p>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResendOTP}
                disabled={sending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Resend OTP
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onPrev} 
          className="flex-1"
          disabled={sending || verifying || submitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        {!otpSent ? (
          <Button 
            onClick={handleSendOTP}
            className="flex-1"
            disabled={!agreed || sending}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send OTP
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={handleVerifyOTP}
            className="flex-1"
            disabled={otp.length !== 6 || verifying || submitting}
          >
            {verifying || submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {submitting ? "Submitting..." : "Verifying..."}
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Verify & Submit
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
