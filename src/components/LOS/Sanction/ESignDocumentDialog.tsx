import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, FileSignature, Copy, ExternalLink } from "lucide-react";
import { useESignRequest } from "@/hooks/useESignDocument";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ESignDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  applicationId: string;
  documentId: string;
  documentType: "sanction_letter" | "loan_agreement" | "daily_schedule" | "combined_loan_pack";
  documentLabel: string;
  defaultSignerName?: string;
  defaultSignerEmail?: string;
  defaultSignerMobile?: string;
  environment?: "uat" | "production";
  onSuccess?: () => void;
}

type AppearancePosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";

export default function ESignDocumentDialog({
  open,
  onOpenChange,
  orgId,
  applicationId,
  documentId,
  documentType,
  documentLabel,
  defaultSignerName = "",
  defaultSignerEmail = "",
  defaultSignerMobile = "",
  environment = "production",
  onSuccess,
}: ESignDocumentDialogProps) {
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail);
  const [signerMobile, setSignerMobile] = useState(defaultSignerMobile);
  const [appearance, setAppearance] = useState<AppearancePosition>("bottom-right");
  const [signerUrl, setSignerUrl] = useState<string | null>(null);
  
  // Notification override fields (for testing or different notification recipient)
  const [notificationPhone, setNotificationPhone] = useState(defaultSignerMobile);
  const [notificationEmail, setNotificationEmail] = useState(defaultSignerEmail);

  // Auto-detect active Nupay environment from DB
  const { data: nupayConfig } = useQuery({
    queryKey: ["nupay-config-active", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nupay_config")
        .select("environment")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!orgId && open,
  });

  // Use detected environment or fallback to production
  const activeEnvironment = (nupayConfig?.environment as "uat" | "production") || environment;

  const esignMutation = useESignRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signerName || !signerMobile || !signerEmail) {
      toast.error("Signer name, mobile, and email are required");
      return;
    }

    // Validate notification mobile number
    const cleanMobile = notificationPhone.replace(/\D/g, "");
    if (cleanMobile.length < 10) {
      toast.error("Please enter a valid 10-digit notification mobile number");
      return;
    }

    try {
      const result = await esignMutation.mutateAsync({
        orgId,
        applicationId,
        documentId,
        documentType,
        signerName,
        signerEmail: notificationEmail || undefined,
        signerMobile: cleanMobile,
        appearance,
        environment: activeEnvironment,
      });

      if (result.signer_url) {
        setSignerUrl(result.signer_url);
      }

      onSuccess?.();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleCopyUrl = () => {
    if (signerUrl) {
      navigator.clipboard.writeText(signerUrl);
      toast.success("Signing URL copied to clipboard");
    }
  };

  const handleOpenUrl = () => {
    if (signerUrl) {
      window.open(signerUrl, "_blank");
    }
  };

  const handleClose = () => {
    setSignerUrl(null);
    onOpenChange(false);
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSignerName(defaultSignerName);
      setSignerEmail(defaultSignerEmail);
      setSignerMobile(defaultSignerMobile);
      setNotificationPhone(defaultSignerMobile);
      setNotificationEmail(defaultSignerEmail);
      setSignerUrl(null);
    }
  }, [open, defaultSignerName, defaultSignerEmail, defaultSignerMobile]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Send for E-Sign
          </DialogTitle>
          <DialogDescription>
            Send <strong>{documentLabel}</strong> for Aadhaar-based digital signature.
          </DialogDescription>
        </DialogHeader>

        {!signerUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signerName">Signer Name *</Label>
              <Input
                id="signerName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter signer's full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signerMobile">Mobile Number *</Label>
              <Input
                id="signerMobile"
                value={signerMobile}
                onChange={(e) => setSignerMobile(e.target.value)}
                placeholder="10-digit mobile number"
                type="tel"
                required
              />
              <p className="text-xs text-muted-foreground">
                OTP will be sent to this number for Aadhaar verification
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signerEmail">Email *</Label>
              <Input
                id="signerEmail"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="signer@email.com"
                type="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appearance">Signature Position</Label>
              <Select value={appearance} onValueChange={(v) => setAppearance(v as AppearancePosition)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <hr className="my-4" />
            <p className="text-sm font-medium text-muted-foreground">Notification Settings</p>
            <p className="text-xs text-muted-foreground mb-2">
              The signing link will be sent to these contacts
            </p>

            <div className="space-y-2">
              <Label htmlFor="notifPhone">Notification Mobile</Label>
              <Input
                id="notifPhone"
                value={notificationPhone}
                onChange={(e) => setNotificationPhone(e.target.value)}
                placeholder="10-digit mobile number"
                type="tel"
              />
              <p className="text-xs text-muted-foreground">
                WhatsApp message with signing link will be sent here
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notifEmail">Notification Email (Optional)</Label>
              <Input
                id="notifEmail"
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="email@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Email with signing link will be sent here
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={esignMutation.isPending}>
                {esignMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send for E-Sign
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">
                E-Sign request sent successfully!
              </p>
              <p className="mt-1 text-xs text-green-700">
                The signing link has been generated. Share it with the borrower.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Signing URL</Label>
              <div className="flex gap-2">
                <Input
                  value={signerUrl}
                  readOnly
                  className="text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleOpenUrl}
                  title="Open URL"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with the borrower. They will need to verify their Aadhaar via OTP to sign.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
