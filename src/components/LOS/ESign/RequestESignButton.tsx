import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Send, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useOrgContext } from "@/hooks/useOrgContext";

interface RequestESignButtonProps {
  applicationId: string;
  documentId?: string;
  documentType: string;
  signerName: string;
  signerPhone?: string;
  signerEmail?: string;
  onSuccess?: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function RequestESignButton({
  applicationId,
  documentId,
  documentType,
  signerName,
  signerPhone = "",
  signerEmail = "",
  onSuccess,
  disabled = false,
  variant = "outline",
  size = "sm",
}: RequestESignButtonProps) {
  const { orgId } = useOrgContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [esignUrl, setEsignUrl] = useState("");

  const [formData, setFormData] = useState({
    signerName,
    signerPhone,
    signerEmail,
    notificationChannel: 'sms' as 'sms' | 'email' | 'both',
  });

  const handleOpen = () => {
    setFormData({
      signerName,
      signerPhone,
      signerEmail,
      notificationChannel: signerPhone ? 'sms' : (signerEmail ? 'email' : 'sms'),
    });
    setShowSuccess(false);
    setEsignUrl("");
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.signerName) {
      toast.error("Signer name is required");
      return;
    }

    if (formData.notificationChannel === 'sms' && !formData.signerPhone) {
      toast.error("Phone number is required for SMS notification");
      return;
    }

    if (formData.notificationChannel === 'email' && !formData.signerEmail) {
      toast.error("Email is required for email notification");
      return;
    }

    if (formData.notificationChannel === 'both' && (!formData.signerPhone || !formData.signerEmail)) {
      toast.error("Both phone and email are required");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("esign-create-request", {
        body: {
          applicationId,
          documentId,
          documentType,
          signerName: formData.signerName,
          signerPhone: formData.signerPhone,
          signerEmail: formData.signerEmail,
          notificationChannel: formData.notificationChannel,
          orgId,
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to create eSign request");
      }

      setEsignUrl(data.esignUrl);
      setShowSuccess(true);
      toast.success(`Signing link sent via ${data.notificationsSent.join(' and ')}`);
      onSuccess?.();
    } catch (error: any) {
      console.error("eSign request error:", error);
      toast.error(error.message || "Failed to send signing link");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(esignUrl);
    toast.success("Link copied to clipboard");
  };

  const documentLabels: Record<string, string> = {
    'kfs': 'Key Fact Statement',
    'sanction_letter': 'Sanction Letter',
    'loan_agreement': 'Loan Agreement',
    'dpn': 'Demand Promissory Note',
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleOpen}
        disabled={disabled}
      >
        <Send className="h-4 w-4 mr-1" />
        Request eSign
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          {showSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Signing Link Sent
                </DialogTitle>
                <DialogDescription>
                  The applicant will receive a link to sign the {documentLabels[documentType] || documentType}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Signing Link</p>
                  <div className="flex gap-2">
                    <Input value={esignUrl} readOnly className="text-xs" />
                    <Button size="icon" variant="outline" onClick={copyToClipboard}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Valid for 24 hours
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setIsOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Request eSign</DialogTitle>
                <DialogDescription>
                  Send a signing link for {documentLabels[documentType] || documentType} to the applicant.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signerName">Signer Name</Label>
                  <Input
                    id="signerName"
                    value={formData.signerName}
                    onChange={(e) => setFormData({ ...formData, signerName: e.target.value })}
                    placeholder="Full name as per documents"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signerPhone">Phone Number</Label>
                  <Input
                    id="signerPhone"
                    value={formData.signerPhone}
                    onChange={(e) => setFormData({ ...formData, signerPhone: e.target.value })}
                    placeholder="+91XXXXXXXXXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signerEmail">Email Address</Label>
                  <Input
                    id="signerEmail"
                    type="email"
                    value={formData.signerEmail}
                    onChange={(e) => setFormData({ ...formData, signerEmail: e.target.value })}
                    placeholder="applicant@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Send Notification Via</Label>
                  <RadioGroup
                    value={formData.notificationChannel}
                    onValueChange={(value) => setFormData({ ...formData, notificationChannel: value as any })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sms" id="sms" />
                      <Label htmlFor="sms" className="font-normal cursor-pointer">SMS/WhatsApp</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="email" id="email" />
                      <Label htmlFor="email" className="font-normal cursor-pointer">Email</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both" className="font-normal cursor-pointer">Both</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Link
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
