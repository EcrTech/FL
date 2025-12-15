import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, FileText, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Step = 'loading' | 'preview' | 'aadhaar' | 'otp' | 'success' | 'error' | 'expired' | 'already_signed';

interface DocumentData {
  requestId: string;
  status: string;
  documentType: string;
  signerName: string;
  application: {
    id: string;
    applicationNumber: string;
    loanAmount: number;
    loanType: string;
    tenureMonths: number;
    interestRate: number;
    processingFee: number;
    applicantName: string;
    applicantAddress: string | null;
  };
  organization: {
    name: string;
  };
  expiresAt: string;
  alreadySigned?: boolean;
  signedAt?: string;
}

const DOCUMENT_LABELS: Record<string, string> = {
  'kfs': 'Key Fact Statement',
  'sanction_letter': 'Sanction Letter',
  'loan_agreement': 'Loan Agreement',
  'dpn': 'Demand Promissory Note',
};

export default function ESignDocument() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  // Form states
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [otp, setOtp] = useState("");
  const [refId, setRefId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("esign-verify-token", {
        body: { token }
      });

      if (error) throw error;

      if (!data.success) {
        setErrorMessage(data.error || "Invalid link");
        setStep(data.error?.includes("expired") ? 'expired' : 'error');
        return;
      }

      if (data.alreadySigned) {
        setDocumentData(data);
        setStep('already_signed');
        return;
      }

      setDocumentData(data);
      setStep('preview');
    } catch (error: any) {
      console.error("Token verification error:", error);
      setErrorMessage(error.message || "Failed to load document");
      setStep('error');
    }
  };

  const handleInitiateAadhaar = async () => {
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      toast.error("Please enter a valid 12-digit Aadhaar number");
      return;
    }

    if (!consent) {
      toast.error("Please provide consent to proceed");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("esign-initiate-aadhaar", {
        body: { token, aadhaarNumber, consent: true }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setRefId(data.refId);
      toast.success(data.message || "OTP sent to your Aadhaar-linked mobile");
      setStep('otp');
    } catch (error: any) {
      console.error("Aadhaar initiation error:", error);
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("esign-complete-sign", {
        body: { token, otp, refId }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Verification failed");
      }

      toast.success("Document signed successfully!");
      setStep('success');
    } catch (error: any) {
      console.error("OTP verification error:", error);
      toast.error(error.message || "OTP verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Loading state
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading document...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error states
  if (step === 'error' || step === 'expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {step === 'expired' ? 'Link Expired' : 'Invalid Link'}
            </h2>
            <p className="text-muted-foreground text-center">
              {errorMessage || (step === 'expired' 
                ? 'This signing link has expired. Please request a new link from your loan officer.'
                : 'This link is invalid or has already been used.'
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already signed state
  if (step === 'already_signed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Already Signed</h2>
            <p className="text-muted-foreground text-center">
              This document was signed on {new Date(documentData?.signedAt || '').toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Document Signed!</h2>
            <p className="text-muted-foreground text-center mb-4">
              Your {DOCUMENT_LABELS[documentData?.documentType || ''] || 'document'} has been successfully signed using Aadhaar eSign.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 w-full">
              <p className="text-sm text-center">
                Application: <span className="font-medium">{documentData?.application.applicationNumber}</span>
              </p>
              <p className="text-sm text-center text-muted-foreground">
                You can close this page now.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">{documentData?.organization.name}</h1>
          <p className="text-muted-foreground">Document Signing Portal</p>
        </div>

        {/* Document Preview */}
        {step === 'preview' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {DOCUMENT_LABELS[documentData?.documentType || ''] || 'Document'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Application Number</p>
                    <p className="font-medium">{documentData?.application.applicationNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Applicant Name</p>
                    <p className="font-medium">{documentData?.application.applicantName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Loan Amount</p>
                    <p className="font-medium">{formatCurrency(documentData?.application.loanAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Loan Type</p>
                    <p className="font-medium">{documentData?.application.loanType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tenure</p>
                    <p className="font-medium">{documentData?.application.tenureMonths} months</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Interest Rate</p>
                    <p className="font-medium">{documentData?.application.interestRate}% p.a.</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    By signing this document, you acknowledge that you have read and agree to all terms and conditions.
                  </p>
                  <Button onClick={() => setStep('aadhaar')} className="w-full">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Proceed to Sign with Aadhaar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Aadhaar Entry */}
        {step === 'aadhaar' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Aadhaar Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="aadhaar">Aadhaar Number</Label>
                <Input
                  id="aadhaar"
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="Enter 12-digit Aadhaar number"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-muted-foreground">
                  An OTP will be sent to your Aadhaar-linked mobile number
                </p>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked as boolean)}
                />
                <label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                  I hereby give my consent to use my Aadhaar details for the purpose of electronically 
                  signing this document. I understand that this eSign is legally binding as per the 
                  Information Technology Act, 2000.
                </label>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('preview')} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleInitiateAadhaar} 
                  disabled={isLoading || !consent || aadhaarNumber.length !== 12}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    'Send OTP'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OTP Verification */}
        {step === 'otp' && (
          <Card>
            <CardHeader>
              <CardTitle>Enter OTP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center mb-4">
                <p className="text-muted-foreground">
                  An OTP has been sent to your Aadhaar-linked mobile number ending with ****{aadhaarNumber.slice(-4)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp">One-Time Password</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('aadhaar')} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleVerifyOtp} 
                  disabled={isLoading || otp.length !== 6}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Sign'
                  )}
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Didn't receive OTP?{' '}
                <button 
                  onClick={() => setStep('aadhaar')} 
                  className="text-primary hover:underline"
                >
                  Resend
                </button>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          This eSign process is secured and compliant with IT Act 2000.
          <br />
          Link valid until {new Date(documentData?.expiresAt || '').toLocaleString('en-IN')}
        </p>
      </div>
    </div>
  );
}
