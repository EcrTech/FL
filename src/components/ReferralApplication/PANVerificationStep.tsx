import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, AlertCircle, ArrowLeft, ArrowRight, CreditCard, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PANVerificationStepProps {
  panNumber: string;
  onPanChange: (pan: string) => void;
  onVerified: (data: { name: string; status: string }) => void;
  onNext: () => void;
  onBack: () => void;
  isVerified: boolean;
  verifiedData?: { name: string; status: string };
}

export function PANVerificationStep({
  panNumber,
  onPanChange,
  onVerified,
  onNext,
  onBack,
  isVerified,
  verifiedData,
}: PANVerificationStepProps) {
  const [verifying, setVerifying] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isValidPan = panRegex.test(panNumber);

  const authenticate = async () => {
    setAuthenticating(true);
    try {
      const { data, error } = await supabase.functions.invoke('sandbox-authenticate', {
        body: {},
      });

      if (error) throw error;

      if (data.access_token) {
        setAccessToken(data.access_token);
        toast.success("Authentication successful");
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      toast.error("Failed to authenticate with verification service");
    } finally {
      setAuthenticating(false);
    }
  };

  const verifyPan = async () => {
    if (!accessToken) {
      toast.error("Please authenticate first");
      return;
    }

    if (!isValidPan) {
      toast.error("Please enter a valid PAN number");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-public-pan', {
        body: {
          panNumber,
          accessToken,
        },
      });

      if (error) throw error;

      if (data.success) {
        onVerified({
          name: data.name || 'Name not available',
          status: data.status || 'Verified',
        });
        toast.success("PAN verified successfully");
      } else {
        toast.error(data.message || "PAN verification failed");
      }
    } catch (error: any) {
      console.error('PAN verification error:', error);
      toast.error(error.message || "Failed to verify PAN");
    } finally {
      setVerifying(false);
    }
  };

  const skipVerification = () => {
    if (!isValidPan) {
      toast.error("Please enter a valid PAN number to continue");
      return;
    }
    onVerified({
      name: 'Pending Verification',
      status: 'Not Verified',
    });
    toast.info("PAN saved. Verification can be done later.");
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">PAN Details</h3>
          <p className="text-sm text-muted-foreground font-body">Enter your PAN number and optionally verify</p>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Personal Details
      </button>

      {/* PAN Input */}
      <div className="space-y-2">
        <Label htmlFor="pan" className="text-sm font-heading font-semibold text-foreground">
          PAN Number <span className="text-[hsl(var(--coral-500))]">*</span>
        </Label>
        <div className="relative">
          <Input
            id="pan"
            placeholder="ABCDE1234F"
            value={panNumber}
            onChange={(e) => onPanChange(e.target.value.toUpperCase().slice(0, 10))}
            disabled={isVerified}
            className="h-14 bg-background border-2 border-border rounded-xl uppercase tracking-[0.2em] font-mono text-lg text-center focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            maxLength={10}
          />
          {isVerified && (
            <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
              <Check className="h-3 w-3 mr-1" /> {verifiedData?.status === 'Not Verified' ? 'Saved' : 'Verified'}
            </Badge>
          )}
        </div>
        {panNumber && !isValidPan && (
          <p className="text-sm text-[hsl(var(--coral-500))] flex items-center gap-1.5 font-body mt-2">
            <AlertCircle className="h-4 w-4" />
            Invalid PAN format (e.g., ABCDE1234F)
          </p>
        )}
        <p className="text-xs text-muted-foreground font-body">
          Format: 5 letters + 4 digits + 1 letter
        </p>
      </div>

      {/* Verified Details */}
      {isVerified && verifiedData && (
        <Card className={`rounded-xl overflow-hidden ${verifiedData.status === 'Not Verified' ? 'bg-muted/50 border-2 border-border' : 'bg-[hsl(var(--success))]/5 border-2 border-[hsl(var(--success))]/20'}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${verifiedData.status === 'Not Verified' ? 'bg-muted-foreground' : 'bg-[hsl(var(--success))]'}`}>
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className={`font-heading font-bold ${verifiedData.status === 'Not Verified' ? 'text-muted-foreground' : 'text-[hsl(var(--success))]'}`}>
                {verifiedData.status === 'Not Verified' ? 'PAN Saved (Pending Verification)' : 'PAN Verified Successfully'}
              </span>
            </div>
            <div className="space-y-3 pl-13">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">PAN Number</span>
                <span className="font-heading font-semibold text-foreground">{panNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Name on PAN</span>
                <span className="font-heading font-semibold text-foreground">{verifiedData.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Status</span>
                <Badge variant="outline" className={`font-heading ${verifiedData.status === 'Not Verified' ? 'bg-muted text-muted-foreground border-border' : 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30'}`}>
                  {verifiedData.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optional Verification Button */}
      {!isVerified && isValidPan && (
        <div className="space-y-3">
          {!accessToken ? (
            <Button
              onClick={authenticate}
              disabled={authenticating}
              variant="outline"
              className="w-full h-12 font-heading font-semibold rounded-xl border-2 border-primary text-primary hover:bg-primary/10"
            >
              {authenticating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  Verify PAN (Optional)
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={verifyPan}
              disabled={verifying}
              variant="outline"
              className="w-full h-12 font-heading font-semibold rounded-xl border-2 border-primary text-primary hover:bg-primary/10"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Verifying PAN...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  Verify PAN
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Next Button - always enabled when PAN is valid */}
      <Button
        onClick={() => {
          if (!isVerified && isValidPan) {
            // Save as unverified and continue
            onVerified({
              name: 'Pending Verification',
              status: 'Not Verified',
            });
          }
          onNext();
        }}
        disabled={!isValidPan}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        Continue to Aadhaar Verification
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
}
