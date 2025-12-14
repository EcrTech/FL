import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BasicInfoStepProps {
  formData: {
    name: string;
    email: string;
    phone: string;
  };
  onUpdate: (data: Partial<{ name: string; email: string; phone: string }>) => void;
  consents: {
    householdIncome: boolean;
    termsAndConditions: boolean;
    aadhaarConsent: boolean;
  };
  onConsentChange: (consent: 'householdIncome' | 'termsAndConditions' | 'aadhaarConsent', value: boolean) => void;
  verificationStatus: {
    emailVerified: boolean;
    phoneVerified: boolean;
  };
  onVerificationComplete: (type: 'email' | 'phone') => void;
  onNext: () => void;
}

export function BasicInfoStep({
  formData,
  onUpdate,
  consents,
  onConsentChange,
  verificationStatus,
  onVerificationComplete,
  onNext,
}: BasicInfoStepProps) {
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailSessionId, setEmailSessionId] = useState("");
  const [phoneSessionId, setPhoneSessionId] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [emailTimer, setEmailTimer] = useState(0);
  const [phoneTimer, setPhoneTimer] = useState(0);

  const startTimer = (type: 'email' | 'phone') => {
    const setTimer = type === 'email' ? setEmailTimer : setPhoneTimer;
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

  const sendOtp = async (type: 'email' | 'phone') => {
    const identifier = type === 'email' ? formData.email : formData.phone;
    
    if (type === 'email' && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    if (type === 'phone' && formData.phone.replace(/\D/g, '').length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    const setSending = type === 'email' ? setSendingEmailOtp : setSendingPhoneOtp;
    const setOtpSent = type === 'email' ? setEmailOtpSent : setPhoneOtpSent;
    const setSessionId = type === 'email' ? setEmailSessionId : setPhoneSessionId;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-public-otp', {
        body: {
          identifier: type === 'phone' ? `+91${formData.phone.replace(/\D/g, '')}` : identifier,
          identifierType: type,
        },
      });

      if (error) throw error;
      
      setSessionId(data.sessionId);
      setOtpSent(true);
      startTimer(type);
      toast.success(`OTP sent to your ${type}`);
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || `Failed to send OTP to ${type}`);
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async (type: 'email' | 'phone') => {
    const sessionId = type === 'email' ? emailSessionId : phoneSessionId;
    const otp = type === 'email' ? emailOtp : phoneOtp;
    const setVerifying = type === 'email' ? setVerifyingEmail : setVerifyingPhone;

    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-public-otp', {
        body: { sessionId, otp },
      });

      if (error) throw error;

      if (data.verified) {
        onVerificationComplete(type);
        toast.success(`${type === 'email' ? 'Email' : 'Phone'} verified successfully`);
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast.error(error.message || 'Invalid OTP');
    } finally {
      setVerifying(false);
    }
  };

  const allConsentsChecked = consents.householdIncome && consents.termsAndConditions && consents.aadhaarConsent;
  const canProceed = formData.name && verificationStatus.emailVerified && verificationStatus.phoneVerified && allConsentsChecked;

  return (
    <div className="space-y-6">
      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-foreground font-medium">Full Name *</Label>
        <Input
          id="name"
          placeholder="Enter your full name"
          value={formData.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-12 bg-background border-border"
        />
      </div>

      {/* Email Field with OTP */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground font-medium">Email Address *</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
              disabled={verificationStatus.emailVerified}
              className="h-12 bg-background border-border pr-20"
            />
            {verificationStatus.emailVerified && (
              <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 text-white">
                <Check className="h-3 w-3 mr-1" /> Verified
              </Badge>
            )}
          </div>
          {!verificationStatus.emailVerified && !emailOtpSent && (
            <Button
              type="button"
              onClick={() => sendOtp('email')}
              disabled={sendingEmailOtp || !formData.email}
              className="h-12 bg-primary hover:bg-primary/90"
            >
              {sendingEmailOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
            </Button>
          )}
        </div>

        {/* Email OTP Input */}
        {emailOtpSent && !verificationStatus.emailVerified && (
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Enter 6-digit OTP"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-12 bg-background border-border"
              maxLength={6}
            />
            <Button
              type="button"
              onClick={() => verifyOtp('email')}
              disabled={verifyingEmail || emailOtp.length !== 6}
              className="h-12 bg-primary hover:bg-primary/90"
            >
              {verifyingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </Button>
            {emailTimer > 0 && (
              <span className="flex items-center text-sm text-muted-foreground min-w-[50px]">
                {formatTimer(emailTimer)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Phone Field with OTP */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-foreground font-medium">Mobile Number *</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              +91
            </div>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter 10-digit mobile"
              value={formData.phone}
              onChange={(e) => onUpdate({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              disabled={verificationStatus.phoneVerified}
              className="h-12 bg-background border-border pl-12 pr-20"
              maxLength={10}
            />
            {verificationStatus.phoneVerified && (
              <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 text-white">
                <Check className="h-3 w-3 mr-1" /> Verified
              </Badge>
            )}
          </div>
          {!verificationStatus.phoneVerified && !phoneOtpSent && (
            <Button
              type="button"
              onClick={() => sendOtp('phone')}
              disabled={sendingPhoneOtp || formData.phone.length !== 10}
              className="h-12 bg-primary hover:bg-primary/90"
            >
              {sendingPhoneOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
            </Button>
          )}
        </div>

        {/* Phone OTP Input */}
        {phoneOtpSent && !verificationStatus.phoneVerified && (
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Enter 6-digit OTP"
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-12 bg-background border-border"
              maxLength={6}
            />
            <Button
              type="button"
              onClick={() => verifyOtp('phone')}
              disabled={verifyingPhone || phoneOtp.length !== 6}
              className="h-12 bg-primary hover:bg-primary/90"
            >
              {verifyingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </Button>
            {phoneTimer > 0 && (
              <span className="flex items-center text-sm text-muted-foreground min-w-[50px]">
                {formatTimer(phoneTimer)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Consent Checkboxes */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="householdIncome"
            checked={consents.householdIncome}
            onCheckedChange={(checked) => onConsentChange('householdIncome', checked as boolean)}
            className="mt-1"
          />
          <Label htmlFor="householdIncome" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
            I/We hereby confirm that the Household Income of my family is more than ₹ 3 Lakh per annum
          </Label>
        </div>

        <div className="flex items-start space-x-3">
          <Checkbox
            id="termsAndConditions"
            checked={consents.termsAndConditions}
            onCheckedChange={(checked) => onConsentChange('termsAndConditions', checked as boolean)}
            className="mt-1"
          />
          <Label htmlFor="termsAndConditions" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
            I have read and agreed to the{' '}
            <a href="/terms" className="text-primary underline" target="_blank">Terms and Conditions</a>,{' '}
            <a href="/privacy" className="text-primary underline" target="_blank">Privacy Policy</a> and{' '}
            <a href="/risk" className="text-primary underline" target="_blank">Gradation of Risk</a>
          </Label>
        </div>

        <div className="flex items-start space-x-3">
          <Checkbox
            id="aadhaarConsent"
            checked={consents.aadhaarConsent}
            onCheckedChange={(checked) => onConsentChange('aadhaarConsent', checked as boolean)}
            className="mt-1"
          />
          <Label htmlFor="aadhaarConsent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
            Aadhaar Consent: I hereby give my consent to fetch my CKYCR record from the Central KYC Records Registry 
            using my KYC identifier. I/we further express my interest and accord consent to receive calls/emails/SMS 
            from MoneyBoxx Finance Limited pertaining to their financial products and offers, notwithstanding my 
            registration with DNC/NDNC. I understand and accept that this consent to override my NDNC registration 
            is limited and specifically for the purpose of receiving communication from MoneyBoxx Finance Limited. 
            I hereby provide consent to pull my Credit Bureau report for the purpose of calculating my Credit score 
            and Eligibility for the loan.
          </Label>
        </div>
      </div>

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg"
      >
        Next
      </Button>
    </div>
  );
}
