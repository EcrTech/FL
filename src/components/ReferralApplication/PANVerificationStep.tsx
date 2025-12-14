import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, AlertCircle, ArrowLeft, ArrowRight, CreditCard, ShieldCheck, Upload, FileText, X, Image } from "lucide-react";
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
  const [parsing, setParsing] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [parsedName, setParsedName] = useState<string | null>(null);
  const [isParsed, setIsParsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isValidPan = panRegex.test(panNumber);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or PDF file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadedFile(file);
    setIsParsed(false);
    onPanChange('');
    setParsedName(null);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setFilePreview(null);
    setIsParsed(false);
    onPanChange('');
    setParsedName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseDocument = async () => {
    if (!uploadedFile) {
      toast.error("Please upload a PAN card image first");
      return;
    }

    setParsing(true);
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      const { data, error } = await supabase.functions.invoke('parse-pan-document', {
        body: {
          fileBase64: base64,
          fileType: uploadedFile.type,
        },
      });

      if (error) throw error;

      if (data.success && data.panNumber) {
        onPanChange(data.panNumber);
        setParsedName(data.name || null);
        setIsParsed(true);
        toast.success("PAN details extracted successfully");
      } else {
        toast.error(data.error || "Could not extract PAN details from the document");
      }
    } catch (error: any) {
      console.error('Document parsing error:', error);
      toast.error(error.message || "Failed to parse document");
    } finally {
      setParsing(false);
    }
  };

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
          name: data.name || parsedName || 'Name not available',
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
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-foreground">PAN Verification</h3>
          <p className="text-sm text-muted-foreground font-body">Upload your PAN card to extract and verify details</p>
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

      {/* Step 1: File Upload */}
      <div className="space-y-4">
        <Label className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
          Upload PAN Card
        </Label>
        
        {!uploadedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="font-heading font-semibold text-foreground mb-1">Click to upload PAN card</p>
            <p className="text-sm text-muted-foreground font-body">JPG, PNG, or PDF (max 5MB)</p>
          </div>
        ) : (
          <Card className="border-2 border-primary/30 rounded-xl overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {filePreview ? (
                  <div className="w-24 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img src={filePreview} alt="PAN preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-24 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-foreground truncate">{uploadedFile.name}</p>
                  <p className="text-sm text-muted-foreground font-body">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </p>
                  {isParsed && (
                    <Badge className="mt-2 bg-[hsl(var(--success))] text-white border-0">
                      <Check className="h-3 w-3 mr-1" /> Details Extracted
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                  disabled={isVerified}
                  className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isVerified}
        />

        {uploadedFile && !isParsed && (
          <Button
            onClick={parseDocument}
            disabled={parsing}
            className="w-full h-12 font-heading font-semibold bg-[hsl(var(--purple-500))] hover:bg-[hsl(var(--purple-500))]/90 text-white rounded-xl"
          >
            {parsing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Extracting Details...
              </>
            ) : (
              <>
                <Image className="h-5 w-5 mr-2" />
                Extract PAN Details
              </>
            )}
          </Button>
        )}
      </div>

      {/* Step 2: Extracted Details */}
      {isParsed && (
        <div className="space-y-4">
          <Label className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
            Verify Extracted Details
          </Label>
          
          <Card className="bg-muted/50 border-2 border-border rounded-xl">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground font-body">PAN Number</Label>
                <div className="relative">
                  <Input
                    value={panNumber}
                    onChange={(e) => onPanChange(e.target.value.toUpperCase().slice(0, 10))}
                    disabled={isVerified}
                    className="h-12 bg-background border-2 border-border rounded-xl uppercase tracking-[0.2em] font-mono text-lg focus:border-primary"
                    maxLength={10}
                  />
                  {isVerified && (
                    <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[hsl(var(--success))] text-white border-0 font-heading">
                      <Check className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  )}
                </div>
                {panNumber && !isValidPan && (
                  <p className="text-sm text-[hsl(var(--coral-500))] flex items-center gap-1.5 font-body">
                    <AlertCircle className="h-4 w-4" />
                    Invalid PAN format
                  </p>
                )}
              </div>
              
              {parsedName && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground font-body">Name on PAN</Label>
                  <Input
                    value={parsedName}
                    disabled
                    className="h-12 bg-background border-2 border-border rounded-xl"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verification Buttons */}
          {!isVerified && (
            <div className="space-y-3">
              {!accessToken ? (
                <Button
                  onClick={authenticate}
                  disabled={authenticating || !isValidPan}
                  className="w-full h-12 font-heading font-semibold bg-[hsl(var(--ocean-500))] hover:bg-[hsl(var(--ocean-500))]/90 text-white rounded-xl"
                >
                  {authenticating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-5 w-5 mr-2" />
                      Authenticate & Verify PAN
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={verifyPan}
                  disabled={verifying || !isValidPan}
                  className="w-full h-12 font-heading font-bold btn-electric rounded-xl"
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
        </div>
      )}

      {/* Verified Details */}
      {isVerified && verifiedData && (
        <Card className="bg-[hsl(var(--success))]/5 border-2 border-[hsl(var(--success))]/20 rounded-xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[hsl(var(--success))] rounded-full flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className="font-heading font-bold text-[hsl(var(--success))]">PAN Verified Successfully</span>
            </div>
            <div className="space-y-3 pl-13">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Name on PAN</span>
                <span className="font-heading font-semibold text-foreground">{verifiedData.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-body text-sm">Status</span>
                <Badge variant="outline" className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30 font-heading">
                  {verifiedData.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={!isVerified}
        className="w-full h-14 text-lg font-heading font-bold btn-electric rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
      >
        Continue to Aadhaar Verification
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
}
