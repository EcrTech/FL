import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Building2, ArrowRight, Shield, Check, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactConsentScreenProps {
  formData: {
    phone: string;
    email: string;
    officeEmail: string;
  };
  onUpdate: (data: Partial<{ phone: string; email: string; officeEmail: string }>) => void;
  consents: {
    householdIncome: boolean;
    termsAndConditions: boolean;
    aadhaarConsent: boolean;
  };
  onConsentChange: (consent: 'householdIncome' | 'termsAndConditions' | 'aadhaarConsent', value: boolean) => void;
  verificationStatus: {
    emailVerified: boolean;
    phoneVerified: boolean;
    officeEmailVerified: boolean;
  };
  onVerificationComplete: (type: 'email' | 'phone' | 'officeEmail') => void;
  onContinue: () => void;
}

export function ContactConsentScreen({
  formData,
  onUpdate,
  consents,
  onConsentChange,
  verificationStatus,
  onVerificationComplete,
  onContinue,
}: ContactConsentScreenProps) {
  // OTP states
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [officeEmailOtpSent, setOfficeEmailOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [officeEmailOtp, setOfficeEmailOtp] = useState("");
  const [phoneSessionId, setPhoneSessionId] = useState("");
  const [emailSessionId, setEmailSessionId] = useState("");
  const [officeEmailSessionId, setOfficeEmailSessionId] = useState("");
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingOfficeEmailOtp, setSendingOfficeEmailOtp] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingOfficeEmail, setVerifyingOfficeEmail] = useState(false);
  const [phoneTimer, setPhoneTimer] = useState(0);
  const [emailTimer, setEmailTimer] = useState(0);
  const [officeEmailTimer, setOfficeEmailTimer] = useState(0);
  const [phoneTestOtp, setPhoneTestOtp] = useState<string | null>(null);

  // Refs to track sent values
  const lastPhoneSentRef = useRef("");
  const lastEmailSentRef = useRef("");
  const lastOfficeEmailSentRef = useRef("");

  const startTimer = (type: 'email' | 'phone' | 'officeEmail') => {
    const setTimer = type === 'email' ? setEmailTimer : type === 'phone' ? setPhoneTimer : setOfficeEmailTimer;
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

  const sendOtp = async (type: 'email' | 'phone' | 'officeEmail') => {
    const identifier = type === 'email' ? formData.email : type === 'phone' ? formData.phone : formData.officeEmail;
    
    if ((type === 'email' || type === 'officeEmail') && !identifier.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return;
    }
    
    if (type === 'phone' && formData.phone.replace(/\D/g, '').length < 10) {
      return;
    }

    const setSending = type === 'email' ? setSendingEmailOtp : type === 'phone' ? setSendingPhoneOtp : setSendingOfficeEmailOtp;
    const setOtpSent = type === 'email' ? setEmailOtpSent : type === 'phone' ? setPhoneOtpSent : setOfficeEmailOtpSent;
    const setSessionId = type === 'email' ? setEmailSessionId : type === 'phone' ? setPhoneSessionId : setOfficeEmailSessionId;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-public-otp', {
        body: {
          identifier: type === 'phone' ? `+91${formData.phone.replace(/\D/g, '')}` : identifier,
          identifierType: type === 'officeEmail' ? 'email' : type,
        },
      });

      if (error) throw error;
      
      setSessionId(data.sessionId);
      setOtpSent(true);
      startTimer(type);
      
      if (type === 'phone') lastPhoneSentRef.current = formData.phone;
      else if (type === 'email') lastEmailSentRef.current = formData.email;
      else lastOfficeEmailSentRef.current = formData.officeEmail;
      
      if (type === 'phone' && data.isTestMode && data.testOtp) {
        setPhoneTestOtp(data.testOtp);
        toast.success(`Test Mode: Use OTP: ${data.testOtp}`);
      } else {
        toast.success(type === 'phone' ? 'OTP sent via WhatsApp' : `OTP sent to your ${type === 'officeEmail' ? 'office email' : type}`);
      }
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || `Failed to send OTP`);
    } finally {
      setSending(false);
    }
  };

  // Auto-send OTP for phone
  useEffect(() => {
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (
      cleanPhone.length === 10 && 
      !phoneOtpSent && 
      !verificationStatus.phoneVerified && 
      !sendingPhoneOtp &&
      lastPhoneSentRef.current !== formData.phone
    ) {
      const timer = setTimeout(() => sendOtp('phone'), 500);
      return () => clearTimeout(timer);
    }
  }, [formData.phone, phoneOtpSent, verificationStatus.phoneVerified, sendingPhoneOtp]);

  // Auto-send OTP for email
  useEffect(() => {
    const isValidEmail = formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    if (
      isValidEmail && 
      !emailOtpSent && 
      !verificationStatus.emailVerified && 
      !sendingEmailOtp &&
      lastEmailSentRef.current !== formData.email
    ) {
      const timer = setTimeout(() => sendOtp('email'), 800);
      return () => clearTimeout(timer);
    }
  }, [formData.email, emailOtpSent, verificationStatus.emailVerified, sendingEmailOtp]);

  // Auto-send OTP for office email
  useEffect(() => {
    const isValidOfficeEmail = formData.officeEmail?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    if (
      isValidOfficeEmail && 
      !officeEmailOtpSent && 
      !verificationStatus.officeEmailVerified && 
      !sendingOfficeEmailOtp &&
      lastOfficeEmailSentRef.current !== formData.officeEmail
    ) {
      const timer = setTimeout(() => sendOtp('officeEmail'), 800);
      return () => clearTimeout(timer);
    }
  }, [formData.officeEmail, officeEmailOtpSent, verificationStatus.officeEmailVerified, sendingOfficeEmailOtp]);

  const verifyOtp = async (type: 'email' | 'phone' | 'officeEmail') => {
    const sessionId = type === 'email' ? emailSessionId : type === 'phone' ? phoneSessionId : officeEmailSessionId;
    const otp = type === 'email' ? emailOtp : type === 'phone' ? phoneOtp : officeEmailOtp;
    const setVerifying = type === 'email' ? setVerifyingEmail : type === 'phone' ? setVerifyingPhone : setVerifyingOfficeEmail;

    if (!sessionId) {
      toast.error("Session expired. Please request a new OTP.");
      return;
    }

    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const fetchResponse = await fetch(`${supabaseUrl}/functions/v1/verify-public-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ sessionId, otp }),
      });
      
      const data = await fetchResponse.json();
      const error = fetchResponse.ok ? null : { message: data.error || 'Request failed' };

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.verified) {
        onVerificationComplete(type);
        const label = type === 'officeEmail' ? 'Office email' : type === 'email' ? 'Email' : 'Phone';
        toast.success(`${label} verified successfully`);
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const allConsentsChecked = consents.householdIncome && consents.termsAndConditions && consents.aadhaarConsent;
  const isValidPhone = formData.phone.replace(/\D/g, '').length === 10;
  const isValidEmail = formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  const officeEmailValid = !formData.officeEmail || verificationStatus.officeEmailVerified;
  
  const canContinue = 
    isValidPhone && 
    isValidEmail &&
    allConsentsChecked &&
    verificationStatus.phoneVerified &&
    verificationStatus.emailVerified &&
    officeEmailValid;

  return (
    <div className="flex flex-col min-h-[calc(100vh-130px)]">
      {/* Title Section */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">
              How do we reach you?
            </h2>
            <p className="text-sm text-muted-foreground">
              We'll send updates on this number
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
          {/* Mobile Number Field */}
          <div className="space-y-2">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide">
              Mobile Number <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="h-[52px] w-14 flex items-center justify-center bg-muted rounded-[14px] border border-border text-sm font-medium text-muted-foreground">
                +91
              </div>
              <div className="relative flex-1">
                <Input
                  type="tel"
                  placeholder="Enter 10-digit mobile"
                  value={formData.phone}
                  onChange={(e) => onUpdate({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  disabled={verificationStatus.phoneVerified}
                  maxLength={10}
                  className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 pr-24"
                />
                {verificationStatus.phoneVerified ? (
                  <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 text-[10px]">
                    <Check className="h-3 w-3 mr-1" /> Verified
                  </Badge>
                ) : sendingPhoneOtp ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                ) : null}
              </div>
            </div>
            {phoneOtpSent && !verificationStatus.phoneVerified && (
              <div className="space-y-2 mt-2">
                {phoneTestOtp && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
                    Test Mode: Use OTP: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">{phoneTestOtp}</code>
                  </div>
                )}
                <div className="flex gap-2 p-3 bg-primary/5 rounded-xl">
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-10 bg-white rounded-lg font-mono tracking-widest text-center"
                    maxLength={6}
                  />
                  <Button
                    onClick={() => verifyOtp('phone')}
                    disabled={verifyingPhone || phoneOtp.length !== 6}
                    className="h-10 px-4 bg-primary hover:bg-primary/90 rounded-lg text-sm"
                  >
                    {verifyingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                  </Button>
                  {phoneTimer > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[45px]">
                      <Clock className="h-3 w-3" />
                      {formatTimer(phoneTimer)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email Address <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => onUpdate({ email: e.target.value })}
                disabled={verificationStatus.emailVerified}
                className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 pr-24"
              />
              {verificationStatus.emailVerified ? (
                <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 text-[10px]">
                  <Check className="h-3 w-3 mr-1" /> Verified
                </Badge>
              ) : sendingEmailOtp ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ) : null}
            </div>
            {emailOtpSent && !verificationStatus.emailVerified && (
              <div className="flex gap-2 p-3 bg-primary/5 rounded-xl mt-2">
                <Input
                  placeholder="Enter 6-digit OTP"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-10 bg-white rounded-lg font-mono tracking-widest text-center"
                  maxLength={6}
                />
                <Button
                  onClick={() => verifyOtp('email')}
                  disabled={verifyingEmail || emailOtp.length !== 6}
                  className="h-10 px-4 bg-primary hover:bg-primary/90 rounded-lg text-sm"
                >
                  {verifyingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
                {emailTimer > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[45px]">
                    <Clock className="h-3 w-3" />
                    {formatTimer(emailTimer)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Office Email Field - Optional */}
          <div className="space-y-2">
            <Label className="text-xs font-heading font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Office Email <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
            </Label>
            <div className="relative">
              <Input
                type="email"
                placeholder="Enter work email"
                value={formData.officeEmail}
                onChange={(e) => onUpdate({ officeEmail: e.target.value })}
                disabled={verificationStatus.officeEmailVerified}
                className="h-[52px] text-base font-body rounded-[14px] border-[1.5px] border-border bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 pr-24"
              />
              {verificationStatus.officeEmailVerified ? (
                <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 text-[10px]">
                  <Check className="h-3 w-3 mr-1" /> Verified
                </Badge>
              ) : sendingOfficeEmailOtp ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ) : null}
            </div>
            {!formData.officeEmail && (
              <p className="text-[11px] text-muted-foreground">
                For official communications
              </p>
            )}
            {officeEmailOtpSent && !verificationStatus.officeEmailVerified && (
              <div className="flex gap-2 p-3 bg-primary/5 rounded-xl mt-2">
                <Input
                  placeholder="Enter 6-digit OTP"
                  value={officeEmailOtp}
                  onChange={(e) => setOfficeEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-10 bg-white rounded-lg font-mono tracking-widest text-center"
                  maxLength={6}
                />
                <Button
                  onClick={() => verifyOtp('officeEmail')}
                  disabled={verifyingOfficeEmail || officeEmailOtp.length !== 6}
                  className="h-10 px-4 bg-primary hover:bg-primary/90 rounded-lg text-sm"
                >
                  {verifyingOfficeEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
                {officeEmailTimer > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[45px]">
                    <Clock className="h-3 w-3" />
                    {formatTimer(officeEmailTimer)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border pt-4">
            <h4 className="text-xs font-heading font-bold text-foreground uppercase tracking-wider mb-3">
              Declarations
            </h4>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={consents.householdIncome}
                  onCheckedChange={(checked) => onConsentChange('householdIncome', checked as boolean)}
                  className="mt-0.5 h-[22px] w-[22px] rounded-md border-2"
                />
                <span className="text-[13px] text-muted-foreground leading-relaxed">
                  Household income {">"} ₹3 Lakh/year
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={consents.termsAndConditions}
                  onCheckedChange={(checked) => onConsentChange('termsAndConditions', checked as boolean)}
                  className="mt-0.5 h-[22px] w-[22px] rounded-md border-2"
                />
                <span className="text-[13px] text-muted-foreground leading-relaxed">
                  I agree to{' '}
                  <a href="/terms" className="text-primary underline" target="_blank">Terms</a>,{' '}
                  <a href="/privacy" className="text-primary underline" target="_blank">Privacy Policy</a>{' '}
                  & Gradation of Risk
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={consents.aadhaarConsent}
                  onCheckedChange={(checked) => onConsentChange('aadhaarConsent', checked as boolean)}
                  className="mt-0.5 h-[22px] w-[22px] rounded-md border-2"
                />
                <span className="text-[13px] text-muted-foreground leading-relaxed">
                  I consent to CKYC verification & communications from Skyrise Credit
                </span>
              </label>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={onContinue}
            disabled={!canContinue}
            className="w-full h-[54px] text-base font-heading font-semibold rounded-[14px] bg-gradient-to-r from-primary to-[hsl(var(--teal-600))] shadow-[var(--shadow-teal)] hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:transform-none"
          >
            Continue to PAN Verification
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>

          {/* Trust footer */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-1">
            <Shield className="h-3.5 w-3.5" />
            <span>Secure · RBI Registered · CKYC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
