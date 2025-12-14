import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
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
      const { data, error } = await supabase.functions.invoke('sandbox-pan-verify', {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-0 h-auto">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pan" className="text-foreground font-medium">PAN Number *</Label>
        <div className="relative">
          <Input
            id="pan"
            placeholder="ABCDE1234F"
            value={panNumber}
            onChange={(e) => onPanChange(e.target.value.toUpperCase().slice(0, 10))}
            disabled={isVerified}
            className="h-12 bg-background border-border uppercase tracking-widest font-mono"
            maxLength={10}
          />
          {isVerified && (
            <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 text-white">
              <Check className="h-3 w-3 mr-1" /> Verified
            </Badge>
          )}
        </div>
        {panNumber && !isValidPan && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Invalid PAN format (e.g., ABCDE1234F)
          </p>
        )}
      </div>

      {/* Verified Details */}
      {isVerified && verifiedData && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name on PAN:</span>
                <span className="font-medium">{verifiedData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  {verifiedData.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {!isVerified && (
        <div className="space-y-3">
          {!accessToken ? (
            <Button
              onClick={authenticate}
              disabled={authenticating}
              className="w-full h-12 bg-secondary hover:bg-secondary/90"
            >
              {authenticating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Authenticating...
                </>
              ) : (
                'Authenticate to Verify'
              )}
            </Button>
          ) : (
            <Button
              onClick={verifyPan}
              disabled={verifying || !isValidPan}
              className="w-full h-12 bg-primary hover:bg-primary/90"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verifying PAN...
                </>
              ) : (
                'Verify PAN'
              )}
            </Button>
          )}
        </div>
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
