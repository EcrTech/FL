import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, AlertCircle, ArrowLeft, ArrowRight, FileCheck, ShieldCheck, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CommunicationAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

interface AadhaarVerificationStepProps {
  aadhaarNumber: string;
  onAadhaarChange: (aadhaar: string) => void;
  onVerified: (data: { name: string; address: string; dob: string }) => void;
  onNext: () => void;
  onBack: () => void;
  isVerified: boolean;
  verifiedData?: { name: string; address: string; dob: string };
  communicationAddress?: CommunicationAddress;
  onCommunicationAddressChange?: (address: CommunicationAddress | null) => void;
  isDifferentAddress?: boolean;
  onDifferentAddressChange?: (isDifferent: boolean) => void;
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export function AadhaarVerificationStep({
  aadhaarNumber,
  onAadhaarChange,
  onVerified,
  onNext,
  onBack,
  isVerified,
  verifiedData,
  communicationAddress,
  onCommunicationAddressChange,
  isDifferentAddress = false,
  onDifferentAddressChange,
}: AadhaarVerificationStepProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(0);
  
  const [localDifferentAddress, setLocalDifferentAddress] = useState(isDifferentAddress);
  const [localCommAddress, setLocalCommAddress] = useState<CommunicationAddress>(
    communicationAddress || { addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" }
  );

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

  const skipVerification = () => {
    if (!isValidAadhaar) {
      toast.error("Please enter a valid 12-digit Aadhaar number to continue");
      return;
    }
    onVerified({
      name: 'Pending Verification',
      address: 'Pending Verification',
      dob: 'Pending Verification',
    });
    toast.info("Aadhaar saved. Verification can be done later.");
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Aadhaar Details</h3>
          <p className="text-sm text-muted-foreground font-body">Enter your Aadhaar number and optionally verify via OTP</p>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to PAN Verification
      </button>

      {/* Aadhaar Input */}
      <div className="space-y-2">
        <Label htmlFor="aadhaar" className="text-sm font-heading font-semibold text-foreground">
          Aadhaar Number <span className="text-[hsl(var(--coral-500))]">*</span>
        </Label>
        <div className="relative">
          <Input
            id="aadhaar"
            placeholder="XXXX XXXX XXXX"
            value={isVerified ? getMaskedAadhaar() : formatAadhaar(aadhaarNumber)}
            onChange={(e) => onAadhaarChange(e.target.value.replace(/\D/g, '').slice(0, 12))}
            disabled={isVerified || otpSent}
            className="h-14 bg-background border-2 border-border rounded-xl tracking-[0.3em] font-mono text-lg text-center focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            maxLength={14}
          />
          {isVerified && (
            <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
              <Check className="h-3 w-3 mr-1" /> {verifiedData?.name === 'Pending Verification' ? 'Saved' : 'Verified'}
            </Badge>
          )}
        </div>
        {aadhaarNumber && !isValidAadhaar && (
          <p className="text-sm text-[hsl(var(--coral-500))] flex items-center gap-1.5 font-body mt-2">
            <AlertCircle className="h-4 w-4" />
            Please enter a valid 12-digit Aadhaar number
          </p>
        )}
        <p className="text-xs text-muted-foreground font-body">
          12-digit unique identification number
        </p>
      </div>

      {/* OTP Input */}
      {otpSent && !isVerified && (
        <div className="p-5 bg-[hsl(var(--electric-blue-100))] rounded-xl border border-[hsl(var(--electric-blue-400))]/20 space-y-4">
          <Label className="text-sm font-heading font-semibold text-foreground">Enter OTP sent to your Aadhaar-linked mobile</Label>
          <div className="flex gap-3">
            <Input
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-12 bg-white border-2 border-border rounded-xl tracking-[0.3em] font-mono text-center"
              maxLength={6}
            />
            <Button
              onClick={verifyAadhaarOtp}
              disabled={verifying || otp.length !== 6}
              className="h-12 px-6 btn-electric rounded-xl font-heading"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify OTP'}
            </Button>
          </div>
          {timer > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
              <Clock className="h-4 w-4" />
              Resend OTP in {formatTimer(timer)}
            </div>
          )}
        </div>
      )}

      {/* Verified Details */}
      {isVerified && verifiedData && (
        <Card className={`rounded-xl overflow-hidden ${verifiedData.name === 'Pending Verification' ? 'bg-muted/50 border-2 border-border' : 'bg-[hsl(var(--success))]/5 border-2 border-[hsl(var(--success))]/20'}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${verifiedData.name === 'Pending Verification' ? 'bg-muted-foreground' : 'bg-[hsl(var(--success))]'}`}>
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className={`font-heading font-bold ${verifiedData.name === 'Pending Verification' ? 'text-muted-foreground' : 'text-[hsl(var(--success))]'}`}>
                {verifiedData.name === 'Pending Verification' ? 'Aadhaar Saved (Pending Verification)' : 'Aadhaar Verified Successfully'}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Aadhaar Number</span>
                <span className="font-heading font-semibold text-foreground">{getMaskedAadhaar()}</span>
              </div>
              {verifiedData.name !== 'Pending Verification' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-body text-sm">Name</span>
                    <span className="font-heading font-semibold text-foreground">{verifiedData.name}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground font-body text-sm">Address</span>
                    <span className="font-body text-foreground text-right max-w-[220px] text-sm">{verifiedData.address}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-body text-sm">Date of Birth</span>
                    <span className="font-heading font-semibold text-foreground">{verifiedData.dob}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Communication Address Checkbox - show when valid Aadhaar entered */}
      {isValidAadhaar && (
        <div className="space-y-4">
          <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-xl border border-border">
            <Checkbox
              id="differentAddress"
              checked={localDifferentAddress}
              onCheckedChange={(checked) => {
                const isChecked = checked === true;
                setLocalDifferentAddress(isChecked);
                onDifferentAddressChange?.(isChecked);
                if (!isChecked) {
                  onCommunicationAddressChange?.(null);
                }
              }}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label 
                htmlFor="differentAddress" 
                className="text-sm font-heading font-semibold text-foreground cursor-pointer"
              >
                Communication address is different from Aadhaar address
              </Label>
              <p className="text-xs text-muted-foreground font-body">
                Check this if you want loan-related documents sent to a different address
              </p>
            </div>
          </div>

          {/* Communication Address Form */}
          {localDifferentAddress && (
            <Card className="rounded-xl border-2 border-primary/20 bg-primary/5">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-heading font-bold text-foreground">Communication Address</span>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-heading font-medium text-foreground">
                    Address Line 1 <span className="text-[hsl(var(--coral-500))]">*</span>
                  </Label>
                  <Input
                    placeholder="House/Flat No., Building Name"
                    value={localCommAddress.addressLine1}
                    onChange={(e) => {
                      const updated = { ...localCommAddress, addressLine1: e.target.value };
                      setLocalCommAddress(updated);
                      onCommunicationAddressChange?.(updated);
                    }}
                    className="h-12 bg-background border-2 border-border rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-heading font-medium text-foreground">
                    Address Line 2
                  </Label>
                  <Input
                    placeholder="Street, Locality, Landmark"
                    value={localCommAddress.addressLine2}
                    onChange={(e) => {
                      const updated = { ...localCommAddress, addressLine2: e.target.value };
                      setLocalCommAddress(updated);
                      onCommunicationAddressChange?.(updated);
                    }}
                    className="h-12 bg-background border-2 border-border rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-heading font-medium text-foreground">
                      City <span className="text-[hsl(var(--coral-500))]">*</span>
                    </Label>
                    <Input
                      placeholder="City"
                      value={localCommAddress.city}
                      onChange={(e) => {
                        const updated = { ...localCommAddress, city: e.target.value };
                        setLocalCommAddress(updated);
                        onCommunicationAddressChange?.(updated);
                      }}
                      className="h-12 bg-background border-2 border-border rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-heading font-medium text-foreground">
                      PIN Code <span className="text-[hsl(var(--coral-500))]">*</span>
                    </Label>
                    <Input
                      placeholder="6-digit PIN"
                      value={localCommAddress.pincode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        const updated = { ...localCommAddress, pincode: value };
                        setLocalCommAddress(updated);
                        onCommunicationAddressChange?.(updated);
                      }}
                      className="h-12 bg-background border-2 border-border rounded-xl"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-heading font-medium text-foreground">
                    State <span className="text-[hsl(var(--coral-500))]">*</span>
                  </Label>
                  <Select
                    value={localCommAddress.state}
                    onValueChange={(value) => {
                      const updated = { ...localCommAddress, state: value };
                      setLocalCommAddress(updated);
                      onCommunicationAddressChange?.(updated);
                    }}
                  >
                    <SelectTrigger className="h-12 bg-background border-2 border-border rounded-xl">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Optional Verification Button */}
      {!otpSent && !isVerified && isValidAadhaar && (
        <div className="space-y-3">
          <Button
            onClick={sendAadhaarOtp}
            disabled={sendingOtp}
            variant="outline"
            className="w-full h-12 font-heading font-semibold rounded-xl border-2 border-primary text-primary hover:bg-primary/10"
          >
            {sendingOtp ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Sending OTP...
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5 mr-2" />
                Verify via OTP (Optional)
              </>
            )}
          </Button>
        </div>
      )}

      {/* Next Button - always enabled when Aadhaar is valid */}
      <Button
        onClick={() => {
          if (!isVerified && isValidAadhaar) {
            // Save as unverified and continue
            onVerified({
              name: 'Pending Verification',
              address: 'Pending Verification',
              dob: 'Pending Verification',
            });
          }
          // Validate communication address if checkbox is checked
          if (localDifferentAddress) {
            if (!localCommAddress.addressLine1 || !localCommAddress.city || !localCommAddress.state || !localCommAddress.pincode) {
              toast.error("Please fill all required communication address fields");
              return;
            }
            if (localCommAddress.pincode.length !== 6) {
              toast.error("Please enter a valid 6-digit PIN code");
              return;
            }
          }
          onNext();
        }}
        disabled={!isValidAadhaar}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        Continue to Video KYC
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
}
