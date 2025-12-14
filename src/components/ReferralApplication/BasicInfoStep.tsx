import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, User, Mail, Phone, Clock, ArrowRight } from "lucide-react";
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
  const canProceed = formData.name && allConsentsChecked;

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Personal Information</h3>
          <p className="text-sm text-muted-foreground font-body">Enter your basic details to get started</p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-heading font-semibold text-foreground">
            Full Name (as per PAN) <span className="text-[hsl(var(--coral-500))]">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="h-12 bg-background border-2 border-border rounded-xl text-base font-body focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>

        {/* Email Field with OTP */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email Address <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </Label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => onUpdate({ email: e.target.value })}
                disabled={verificationStatus.emailVerified}
                className="h-12 bg-background border-2 border-border rounded-xl text-base font-body pr-28 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              />
              {verificationStatus.emailVerified && (
                <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
                  <Check className="h-3 w-3 mr-1" /> Verified
                </Badge>
              )}
            </div>
            {!verificationStatus.emailVerified && !emailOtpSent && (
              <Button
                type="button"
                onClick={() => sendOtp('email')}
                disabled={sendingEmailOtp || !formData.email}
                className="h-12 px-6 btn-electric rounded-xl font-heading"
              >
                {sendingEmailOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
              </Button>
            )}
          </div>

          {/* Email OTP Input */}
          {emailOtpSent && !verificationStatus.emailVerified && (
            <div className="flex gap-3 mt-3 p-4 bg-[hsl(var(--electric-blue-100))] rounded-xl border border-[hsl(var(--electric-blue-400))]/20">
              <Input
                placeholder="Enter 6-digit OTP"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-11 bg-white border-2 border-border rounded-xl font-body tracking-widest"
                maxLength={6}
              />
              <Button
                type="button"
                onClick={() => verifyOtp('email')}
                disabled={verifyingEmail || emailOtp.length !== 6}
                className="h-11 px-5 btn-electric rounded-xl font-heading"
              >
                {verifyingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
              {emailTimer > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body min-w-[60px]">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTimer(emailTimer)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phone Field with OTP */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Mobile Number <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </Label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-heading font-semibold text-sm">
                +91
              </div>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter 10-digit mobile"
                value={formData.phone}
                onChange={(e) => onUpdate({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                disabled={verificationStatus.phoneVerified}
                className="h-12 bg-background border-2 border-border rounded-xl pl-14 pr-28 text-base font-body focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                maxLength={10}
              />
              {verificationStatus.phoneVerified && (
                <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
                  <Check className="h-3 w-3 mr-1" /> Verified
                </Badge>
              )}
            </div>
            {!verificationStatus.phoneVerified && !phoneOtpSent && (
              <Button
                type="button"
                onClick={() => sendOtp('phone')}
                disabled={sendingPhoneOtp || formData.phone.length !== 10}
                className="h-12 px-6 btn-electric rounded-xl font-heading"
              >
                {sendingPhoneOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
              </Button>
            )}
          </div>

          {/* Phone OTP Input */}
          {phoneOtpSent && !verificationStatus.phoneVerified && (
            <div className="flex gap-3 mt-3 p-4 bg-[hsl(var(--electric-blue-100))] rounded-xl border border-[hsl(var(--electric-blue-400))]/20">
              <Input
                placeholder="Enter 6-digit OTP"
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-11 bg-white border-2 border-border rounded-xl font-body tracking-widest"
                maxLength={6}
              />
              <Button
                type="button"
                onClick={() => verifyOtp('phone')}
                disabled={verifyingPhone || phoneOtp.length !== 6}
                className="h-11 px-5 btn-electric rounded-xl font-heading"
              >
                {verifyingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
              {phoneTimer > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body min-w-[60px]">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTimer(phoneTimer)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Consent Section */}
      <div className="space-y-4 pt-6 border-t border-border">
        <h4 className="text-sm font-heading font-bold text-foreground uppercase tracking-wider">Consents & Declarations</h4>
        
        <div className="space-y-4 p-5 rounded-xl border-2 border-border bg-muted/30">
          <div className="flex items-start space-x-4">
            <Checkbox
              id="householdIncome"
              checked={consents.householdIncome}
              onCheckedChange={(checked) => onConsentChange('householdIncome', checked as boolean)}
              className="mt-0.5 h-5 w-5 rounded border-2"
            />
            <Label htmlFor="householdIncome" className="text-sm text-muted-foreground font-body leading-relaxed cursor-pointer">
              I/We hereby confirm that the Household Income of my family is more than ₹ 3 Lakh per annum
            </Label>
          </div>

          <div className="flex items-start space-x-4">
            <Checkbox
              id="termsAndConditions"
              checked={consents.termsAndConditions}
              onCheckedChange={(checked) => onConsentChange('termsAndConditions', checked as boolean)}
              className="mt-0.5 h-5 w-5 rounded border-2"
            />
            <Label htmlFor="termsAndConditions" className="text-sm text-muted-foreground font-body leading-relaxed cursor-pointer">
              I have read and agreed to the{' '}
              <a href="/terms" className="text-primary font-semibold hover:underline" target="_blank">Terms and Conditions</a>,{' '}
              <a href="/privacy" className="text-primary font-semibold hover:underline" target="_blank">Privacy Policy</a> and{' '}
              <a href="/risk" className="text-primary font-semibold hover:underline" target="_blank">Gradation of Risk</a>
            </Label>
          </div>

          <div className="flex items-start space-x-4 p-4 bg-[hsl(var(--coral-500))]/5 rounded-lg border-l-4 border-[hsl(var(--coral-500))]">
            <Checkbox
              id="aadhaarConsent"
              checked={consents.aadhaarConsent}
              onCheckedChange={(checked) => onConsentChange('aadhaarConsent', checked as boolean)}
              className="mt-0.5 h-5 w-5 rounded border-2"
            />
            <Label htmlFor="aadhaarConsent" className="text-sm text-muted-foreground font-body leading-relaxed cursor-pointer">
              <span className="font-heading font-semibold text-foreground">Aadhaar Consent:</span> I hereby give my consent to fetch my CKYCR record from the Central KYC Records Registry 
              using my KYC identifier. I/we further express my interest and accord consent to receive calls/emails/SMS 
              from MoneyBoxx Finance Limited pertaining to their financial products and offers.
            </Label>
          </div>
        </div>
      </div>

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        Continue to PAN Verification
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
}
