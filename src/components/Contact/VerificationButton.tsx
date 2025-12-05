import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";
import { CheckCircle, Loader2, ShieldCheck, Send } from "lucide-react";

interface VerificationButtonProps {
  type: "mobile" | "email";
  target: string;
  contactId?: string;
  orgId: string;
  isVerified?: boolean;
  onVerified?: () => void;
  compact?: boolean;
}

export default function VerificationButton({
  type,
  target,
  contactId,
  orgId,
  isVerified = false,
  onVerified,
  compact = false,
}: VerificationButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const notify = useNotification();

  const handleSendOTP = async () => {
    if (!target) {
      notify.error("Missing target", `Please provide a valid ${type === "mobile" ? "phone number" : "email"}`);
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-otp", {
        body: { type, target, contactId, orgId },
      });

      if (fnError) throw fnError;

      if (data.success) {
        setOtpSent(true);
        setOtpId(data.otpId);
        notify.success("OTP Sent", `Verification code sent to your ${type}`);
        
        if (data.warning) {
          console.warn(data.warning);
        }
      } else {
        throw new Error(data.error || "Failed to send OTP");
      }
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setError(err.message || "Failed to send OTP");
      notify.error("Error", err.message || "Failed to send OTP");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-otp", {
        body: { otpId, otp, contactId, type, target },
      });

      if (fnError) throw fnError;

      if (data.success && data.verified) {
        notify.success("Verified!", `${type === "mobile" ? "Phone number" : "Email"} verified successfully`);
        setIsDialogOpen(false);
        resetState();
        onVerified?.();
      } else {
        throw new Error(data.error || "Verification failed");
      }
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      setError(err.message || "Verification failed");
      if (err.remainingAttempts !== undefined) {
        setRemainingAttempts(err.remainingAttempts);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const resetState = () => {
    setOtpSent(false);
    setOtpId(null);
    setOtp("");
    setError(null);
    setRemainingAttempts(null);
  };

  const handleOpenDialog = () => {
    resetState();
    setIsDialogOpen(true);
  };

  if (isVerified) {
    return compact ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <Badge variant="outline" className="text-green-600 border-green-600">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verified
      </Badge>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={handleOpenDialog}
        className={compact ? "h-7 px-2 text-xs" : ""}
      >
        <ShieldCheck className={compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2"} />
        Verify
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {type === "mobile" ? "Verify Phone Number" : "Verify Email"}
            </DialogTitle>
            <DialogDescription>
              {otpSent
                ? `Enter the 6-digit code sent to ${target}`
                : `We'll send a verification code to ${target}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!otpSent ? (
              <Button
                onClick={handleSendOTP}
                disabled={isSending}
                className="w-full"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Verification Code
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-widest"
                  />
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {remainingAttempts} attempts remaining
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSendOTP}
                    disabled={isSending}
                    className="flex-1"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Resend"
                    )}
                  </Button>
                  <Button
                    onClick={handleVerifyOTP}
                    disabled={isVerifying || otp.length !== 6}
                    className="flex-1"
                  >
                    {isVerifying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Verify
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
