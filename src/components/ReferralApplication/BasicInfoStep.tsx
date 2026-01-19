import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, User, Mail, Phone, Clock, ArrowRight, IndianRupee, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BasicInfoStepProps {
  formData: {
    name: string;
    email: string;
    phone: string;
    requestedAmount: number;
    tenureDays: number;
  };
  onUpdate: (data: Partial<{ name: string; email: string; phone: string; requestedAmount: number; tenureDays: number }>) => void;
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
  const [phoneTestOtp, setPhoneTestOtp] = useState<string | null>(null);

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
      
      // Handle test mode for phone OTP
      if (type === 'phone' && data.isTestMode && data.testOtp) {
        setPhoneTestOtp(data.testOtp);
        toast.success(`Test Mode: WhatsApp not configured. Use OTP: ${data.testOtp}`);
      } else {
        toast.success(type === 'phone' ? 'OTP sent via WhatsApp' : `OTP sent to your ${type}`);
      }
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || `Failed to send OTP to ${type}`);
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async (type: 'email' | 'phone') => {
    const startTime = Date.now();
    console.log(`[OTP Verify] ========== START ==========`);
    console.log(`[OTP Verify] Timestamp: ${new Date().toISOString()}`);
    console.log(`[OTP Verify] Type: ${type}`);
    console.log(`[OTP Verify] Supabase URL configured: ${!!import.meta.env.VITE_SUPABASE_URL}`);
    
    const sessionId = type === 'email' ? emailSessionId : phoneSessionId;
    const otp = type === 'email' ? emailOtp : phoneOtp;
    const setVerifying = type === 'email' ? setVerifyingEmail : setVerifyingPhone;

    console.log(`[OTP Verify] State snapshot:`, {
      emailSessionId: emailSessionId ? `${emailSessionId.substring(0, 8)}...` : 'null',
      phoneSessionId: phoneSessionId ? `${phoneSessionId.substring(0, 8)}...` : 'null',
      emailOtp: emailOtp ? `length=${emailOtp.length}` : 'empty',
      phoneOtp: phoneOtp ? `length=${phoneOtp.length}` : 'empty',
      verifyingEmail,
      verifyingPhone,
      emailVerified: verificationStatus.emailVerified,
      phoneVerified: verificationStatus.phoneVerified,
    });

    if (!sessionId) {
      console.log(`[OTP Verify] Branch: No session ID - aborting`);
      toast.error("Session expired. Please request a new OTP.");
      if (type === 'email') {
        setEmailOtpSent(false);
        setEmailOtp("");
      } else {
        setPhoneOtpSent(false);
        setPhoneOtp("");
      }
      console.log(`[OTP Verify] ========== END (no session) ==========`);
      return;
    }

    if (otp.length !== 6) {
      console.log(`[OTP Verify] Branch: Invalid OTP length (${otp.length}) - aborting`);
      toast.error("Please enter a valid 6-digit OTP");
      console.log(`[OTP Verify] ========== END (invalid otp length) ==========`);
      return;
    }

    console.log(`[OTP Verify] Validation passed, setting verifying=true at ${Date.now() - startTime}ms`);
    setVerifying(true);
    
    try {
      // v2 - Using direct fetch to bypass supabase.functions.invoke hanging issue
      console.log(`[OTP Verify v2] About to invoke verify-public-otp`);
      console.log(`[OTP Verify v2] Request body:`, { 
        sessionId: sessionId.substring(0, 8) + '...', 
        otpLength: otp.length 
      });
      
      // Debug Supabase client state
      console.log(`[OTP Verify] Supabase client check:`, {
        supabaseExists: !!supabase,
        functionsExists: !!supabase?.functions,
        invokeExists: typeof supabase?.functions?.invoke,
      });
      
      console.log(`[OTP Verify] Invoking edge function at ${Date.now() - startTime}ms`);
      
      // Use direct fetch instead of supabase.functions.invoke to diagnose the hanging issue
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      console.log(`[OTP Verify] Using direct fetch to: ${supabaseUrl}/functions/v1/verify-public-otp`);
      
      const fetchResponse = await fetch(`${supabaseUrl}/functions/v1/verify-public-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ sessionId, otp }),
      });
      
      console.log(`[OTP Verify] Fetch response status: ${fetchResponse.status}`);
      const data = await fetchResponse.json();
      const error = fetchResponse.ok ? null : { message: data.error || 'Request failed' };
      
      console.log(`[OTP Verify] Edge function returned at ${Date.now() - startTime}ms`);
      console.log(`[OTP Verify] Raw response - data type: ${typeof data}, error type: ${typeof error}`);
      console.log(`[OTP Verify] Response data:`, JSON.stringify(data, null, 2));
      console.log(`[OTP Verify] Response error:`, error ? JSON.stringify(error, null, 2) : 'null');

      if (error) {
        console.log(`[OTP Verify] Branch: error exists`);
        console.error(`[OTP Verify] Function error details:`, error);
        throw new Error(error.message || 'Verification failed');
      }

      if (data?.error) {
        console.log(`[OTP Verify] Branch: data.error exists - ${data.error}`);
        throw new Error(data.error);
      }

      if (data?.verified) {
        console.log(`[OTP Verify] Branch: data.verified is true - calling onVerificationComplete`);
        onVerificationComplete(type);
        console.log(`[OTP Verify] onVerificationComplete called successfully`);
        toast.success(`${type === 'email' ? 'Email' : 'Phone'} verified successfully`);
      } else {
        console.log(`[OTP Verify] Branch: data.verified is falsy - value: ${data?.verified}`);
        toast.error("Verification failed. Please try again.");
      }
    } catch (error: any) {
      console.error(`[OTP Verify] Catch block error at ${Date.now() - startTime}ms:`, error);
      console.error(`[OTP Verify] Error name: ${error?.name}, message: ${error?.message}`);
      toast.error(error.message || 'Invalid OTP. Please try again.');
    } finally {
      console.log(`[OTP Verify] Finally block - setting verifying to false for ${type}`);
      console.log(`[OTP Verify] Total execution time: ${Date.now() - startTime}ms`);
      setVerifying(false);
      console.log(`[OTP Verify] ========== END ==========`);
    }
  };

  const allConsentsChecked = consents.householdIncome && consents.termsAndConditions && consents.aadhaarConsent;
  const isValidPhone = formData.phone.replace(/\D/g, '').length === 10;
  const isValidLoanAmount = formData.requestedAmount >= 5000 && formData.requestedAmount <= 100000;
  const isValidTenure = formData.tenureDays >= 1 && formData.tenureDays <= 90;
  const canProceed = formData.name && isValidPhone && isValidLoanAmount && isValidTenure && allConsentsChecked;

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
        {/* Loan Amount Field - First and Mandatory */}
        <div className="space-y-2">
          <Label htmlFor="loanAmount" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
            Loan Amount Required <span className="text-[hsl(var(--coral-500))]">*</span>
          </Label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-heading font-semibold text-sm">
              ₹
            </div>
            <Input
              id="loanAmount"
              type="number"
              placeholder="Enter amount (₹5,000 - ₹1,00,000)"
              value={formData.requestedAmount || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                onUpdate({ requestedAmount: value });
              }}
              min={5000}
              max={100000}
              className="h-12 bg-background border-2 border-border rounded-xl pl-10 text-base font-body focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </div>
          <p className="text-xs text-muted-foreground font-body">
            Minimum ₹5,000 • Maximum ₹1,00,000
          </p>
          {formData.requestedAmount > 0 && (formData.requestedAmount < 5000 || formData.requestedAmount > 100000) && (
            <p className="text-xs text-[hsl(var(--coral-500))] font-body">
              Please enter an amount between ₹5,000 and ₹1,00,000
            </p>
          )}
        </div>

        {/* Tenure Days Field - Mandatory */}
        <div className="space-y-2">
          <Label htmlFor="tenureDays" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Tenure (Number of Days) <span className="text-[hsl(var(--coral-500))]">*</span>
          </Label>
          <Input
            id="tenureDays"
            type="number"
            placeholder="Enter tenure in days (1 - 90)"
            value={formData.tenureDays || ''}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              onUpdate({ tenureDays: value });
            }}
            min={1}
            max={90}
            className="h-12 bg-background border-2 border-border rounded-xl text-base font-body focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
          <p className="text-xs text-muted-foreground font-body">
            Minimum 1 day • Maximum 90 days
          </p>
          {formData.tenureDays > 0 && (formData.tenureDays < 1 || formData.tenureDays > 90) && (
            <p className="text-xs text-[hsl(var(--coral-500))] font-body">
              Please enter a tenure between 1 and 90 days
            </p>
          )}
        </div>

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

        {/* Phone Field with OTP - Now first and mandatory */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Mobile Number <span className="text-[hsl(var(--coral-500))]">*</span>
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
            <div className="space-y-2 mt-3">
              {phoneTestOtp && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
                  <strong>Test Mode:</strong> SMS not configured. Use OTP: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">{phoneTestOtp}</code>
                </div>
              )}
              <div className="flex gap-3 p-4 bg-[hsl(var(--electric-blue-100))] rounded-xl border border-[hsl(var(--electric-blue-400))]/20">
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
            </div>
          )}
        </div>

        {/* Email Field with OTP - Now second and optional */}
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
              from Skyrise Credit and Marketing Limited pertaining to their financial products and offers.
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
