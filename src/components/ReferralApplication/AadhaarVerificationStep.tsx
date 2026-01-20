import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, ArrowLeft, ArrowRight, FileCheck, ShieldCheck, MapPin, ExternalLink } from "lucide-react";
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
  onVerified: (data: { name: string; address: string; dob: string; aadhaarNumber?: string }) => void;
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
  const [searchParams] = useSearchParams();
  const [initiatingDigilocker, setInitiatingDigilocker] = useState(false);
  
  const [localDifferentAddress, setLocalDifferentAddress] = useState(isDifferentAddress);
  const [localCommAddress, setLocalCommAddress] = useState<CommunicationAddress>(
    communicationAddress || { addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" }
  );

  // Check for DigiLocker return on mount
  useEffect(() => {
    const digilockerSuccess = searchParams.get("digilocker_success");
    const digilockerFailure = searchParams.get("digilocker_failure");
    
    if (digilockerSuccess === "true") {
      // Retrieve verified data from localStorage
      const storedData = localStorage.getItem("referral_aadhaar_verified");
      if (storedData) {
        try {
          const verifiedInfo = JSON.parse(storedData);
          onVerified(verifiedInfo);
          toast.success("Aadhaar verified successfully via DigiLocker");
        } catch (e) {
          console.error("Failed to parse verified Aadhaar data:", e);
        }
        localStorage.removeItem("referral_aadhaar_verified");
      }
      // Clean URL params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    } else if (digilockerFailure === "true") {
      toast.error("DigiLocker verification failed. Please try again.");
      // Clean URL params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams, onVerified]);

  const initiateDigilocker = async () => {
    setInitiatingDigilocker(true);
    try {
      const currentUrl = window.location.href.split('?')[0]; // Remove existing params
      const baseUrl = window.location.origin;
      
      // Store referral context for return
      localStorage.setItem('referral_aadhaar_pending', JSON.stringify({
        returnUrl: currentUrl,
        commAddress: localDifferentAddress ? localCommAddress : null,
        isDifferentAddress: localDifferentAddress,
      }));
      
      const { data, error } = await supabase.functions.invoke('verifiedu-public-aadhaar-initiate', {
        body: {
          surl: `${baseUrl}/digilocker/success`,
          furl: `${baseUrl}/digilocker/failure`,
        },
      });

      if (error) throw error;
      
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else if (data?.is_mock && data?.mock_redirect_url) {
        // Handle mock mode redirect
        window.location.href = data.mock_redirect_url;
      } else {
        throw new Error(data?.message || "Failed to initiate DigiLocker verification");
      }
    } catch (error: any) {
      console.error('Error initiating DigiLocker:', error);
      toast.error(error.message || "Failed to initiate DigiLocker verification");
      localStorage.removeItem('referral_aadhaar_pending');
    } finally {
      setInitiatingDigilocker(false);
    }
  };

  const getMaskedAadhaar = (aadhaarNumber?: string) => {
    if (aadhaarNumber && aadhaarNumber.length >= 4) {
      return `XXXX XXXX ${aadhaarNumber.slice(-4)}`;
    }
    return "XXXX XXXX XXXX";
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">Identity Verification</h3>
          <p className="text-sm text-muted-foreground font-body">
            {isVerified ? "Your identity has been verified" : "Verify your identity using DigiLocker"}
          </p>
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

      {/* Verified Details Card */}
      {isVerified && verifiedData && (
        <Card className="rounded-xl overflow-hidden bg-[hsl(var(--success))]/5 border-2 border-[hsl(var(--success))]/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[hsl(var(--success))]">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className="font-heading font-bold text-[hsl(var(--success))]">
                Aadhaar Verified Successfully
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Aadhaar Number</span>
                <span className="font-heading font-semibold text-foreground">{getMaskedAadhaar()}</span>
              </div>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* DigiLocker Verification Section - Show when not verified */}
      {!isVerified && (
        <div className="space-y-4">
          <Card className="rounded-xl border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-lg text-foreground mb-2">
                  Verify via DigiLocker
                </h4>
                <p className="text-sm text-muted-foreground font-body">
                  Complete your Aadhaar verification securely through DigiLocker. 
                  This is required to proceed with your loan application.
                </p>
              </div>
              <Button
                onClick={initiateDigilocker}
                disabled={initiatingDigilocker}
                className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl"
              >
                {initiatingDigilocker ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Redirecting to DigiLocker...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5 mr-2" />
                    Verify with DigiLocker
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground font-body">
                You will be redirected to DigiLocker to verify your Aadhaar securely
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Communication Address Section - Show only when verified */}
      {isVerified && (
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

      {/* Next Button - only enabled when verified */}
      <Button
        onClick={() => {
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
        disabled={!isVerified}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        {isVerified ? (
          <>
            Continue to Video KYC
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        ) : (
          <>
            Complete DigiLocker Verification to Continue
          </>
        )}
      </Button>
    </div>
  );
}
