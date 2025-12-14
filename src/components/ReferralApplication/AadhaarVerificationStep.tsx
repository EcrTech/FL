import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AadhaarVerificationStepProps {
  aadhaarNumber: string;
  onAadhaarChange: (aadhaar: string) => void;
  onVerified: (data: { name: string; address: string; dob: string }) => void;
  onNext: () => void;
  onBack: () => void;
  isVerified: boolean;
  verifiedData?: { name: string; address: string; dob: string };
}

export function AadhaarVerificationStep({
  aadhaarNumber,
  onAadhaarChange,
  onVerified,
  onNext,
  onBack,
  isVerified,
  verifiedData,
}: AadhaarVerificationStepProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(0);

  const isValidAadhaar = /^\d{12}$/.test(aadhaarNumber.replace(/\s/g, ''));

  const formatAadhaar = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const getMaskedAadhaar = () => {
    const digits = aadhaarNumber.replace(/\s/g, '');
    if (digits.length === 12) {
      return `XXXX XXXX ${digits.slice(-4)}`;
    }
    return aadhaarNumber;
  };

  const startTimer = () => {
    setTimer(120);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendAadhaarOtp = async () => {
    if (!isValidAadhaar) {
      toast.error("Please enter a valid 12-digit Aadhaar number");
      return;
    }

    setSendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('sandbox-aadhaar-okyc', {
        body: {
          action: 'initiate',
          aadhaarNumber: aadhaarNumber.replace(/\s/g, ''),
        },
      });

      if (error) throw error;

      if (data.reference_id) {
        setReferenceId(data.reference_id);
        setOtpSent(true);
        startTimer();
        toast.success("OTP sent to your Aadhaar-linked mobile");
      } else {
        throw new Error(data.message || "Failed to send OTP");
      }
    } catch (error: any) {
      console.error('Error sending Aadhaar OTP:', error);
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyAadhaarOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('sandbox-aadhaar-okyc', {
        body: {
          action: 'verify',
          referenceId,
          otp,
        },
      });

      if (error) throw error;

      if (data.status === 'success' || data.verified) {
        const verifiedInfo = {
          name: data.name || data.full_name || 'Name not available',
          address: data.address || data.full_address || 'Address not available',
          dob: data.dob || data.date_of_birth || 'DOB not available',
        };
        onVerified(verifiedInfo);
        toast.success("Aadhaar verified successfully");
      } else {
        throw new Error(data.message || "Verification failed");
      }
    } catch (error: any) {
      console.error('Error verifying Aadhaar:', error);
      toast.error(error.message || "Failed to verify Aadhaar");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-0 h-auto">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="aadhaar" className="text-foreground font-medium">Aadhaar Number *</Label>
        <div className="relative">
          <Input
            id="aadhaar"
            placeholder="XXXX XXXX XXXX"
            value={isVerified ? getMaskedAadhaar() : formatAadhaar(aadhaarNumber)}
            onChange={(e) => onAadhaarChange(e.target.value.replace(/\D/g, '').slice(0, 12))}
            disabled={isVerified || otpSent}
            className="h-12 bg-background border-border tracking-widest font-mono"
            maxLength={14}
          />
          {isVerified && (
            <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 text-white">
              <Check className="h-3 w-3 mr-1" /> Verified
            </Badge>
          )}
        </div>
        {aadhaarNumber && !isValidAadhaar && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Please enter a valid 12-digit Aadhaar number
          </p>
        )}
      </div>

      {/* OTP Input */}
      {otpSent && !isVerified && (
        <div className="space-y-2">
          <Label className="text-foreground font-medium">Enter OTP</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-12 bg-background border-border tracking-widest"
              maxLength={6}
            />
            <Button
              onClick={verifyAadhaarOtp}
              disabled={verifying || otp.length !== 6}
              className="h-12 bg-primary hover:bg-primary/90"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </Button>
            {timer > 0 && (
              <span className="flex items-center text-sm text-muted-foreground min-w-[50px]">
                {formatTimer(timer)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Verified Details */}
      {isVerified && verifiedData && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{verifiedData.name}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-medium text-right max-w-[200px]">{verifiedData.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date of Birth:</span>
                <span className="font-medium">{verifiedData.dob}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send OTP Button */}
      {!otpSent && !isVerified && (
        <Button
          onClick={sendAadhaarOtp}
          disabled={sendingOtp || !isValidAadhaar}
          className="w-full h-12 bg-primary hover:bg-primary/90"
        >
          {sendingOtp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Sending OTP...
            </>
          ) : (
            'Send OTP'
          )}
        </Button>
      )}

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={!isVerified}
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg"
      >
        Next
      </Button>
    </div>
  );
}
