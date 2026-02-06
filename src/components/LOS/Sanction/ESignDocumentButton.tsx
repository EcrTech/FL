import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSignature, RefreshCw, Loader2, Send, RotateCcw } from "lucide-react";
import ESignDocumentDialog from "./ESignDocumentDialog";
import ESignStatusBadge from "./ESignStatusBadge";
import { useESignRequests, useCheckESignStatus } from "@/hooks/useESignDocument";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ESignDocumentButtonProps {
  orgId: string;
  applicationId: string;
  documentId: string;
  documentType: "sanction_letter" | "loan_agreement" | "daily_schedule" | "combined_loan_pack";
  documentLabel: string;
  signerName?: string;
  signerEmail?: string;
  signerMobile?: string;
  disabled?: boolean;
  environment?: "uat" | "production";
  onSuccess?: () => void;
}

export default function ESignDocumentButton({
  orgId,
  applicationId,
  documentId,
  documentType,
  documentLabel,
  signerName = "",
  signerEmail = "",
  signerMobile = "",
  disabled = false,
  environment = "production",
  onSuccess,
}: ESignDocumentButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isResendingLink, setIsResendingLink] = useState(false);

  const { data: esignRequests } = useESignRequests(applicationId);
  const checkStatusMutation = useCheckESignStatus();

  // Find the latest e-sign request for this document type
  const latestRequest = esignRequests?.find(
    (req) => req.document_type === documentType
  );

  const hasActiveRequest = latestRequest && 
    ["pending", "sent", "viewed"].includes(latestRequest.status);
  
  const isSigned = latestRequest?.status === "signed";

  const handleCheckStatus = () => {
    if (latestRequest) {
      checkStatusMutation.mutate({
        orgId,
        esignRequestId: latestRequest.id,
        environment,
      });
    }
  };

  const handleResendLink = async () => {
    if (!latestRequest?.signer_url) {
      toast.error("No signing URL available to resend");
      return;
    }

    setIsResendingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-esign-notifications", {
        body: {
          org_id: orgId,
          application_id: applicationId,
          signer_name: latestRequest.signer_name,
          signer_email: latestRequest.signer_email,
          signer_phone: latestRequest.signer_phone,
          signer_url: latestRequest.signer_url,
          document_type: documentType,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to resend notifications");

      toast.success("Signing link resent via WhatsApp & Email");
    } catch (err) {
      console.error("Resend link error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to resend link");
    } finally {
      setIsResendingLink(false);
    }
  };

  if (isSigned) {
    return (
      <div className="flex items-center gap-2">
        <ESignStatusBadge
          status="signed"
          signedAt={latestRequest.signed_at}
          viewedAt={latestRequest.viewed_at}
          sentAt={latestRequest.notification_sent_at}
        />
      </div>
    );
  }

  if (hasActiveRequest) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <ESignStatusBadge
          status={latestRequest.status as "pending" | "sent" | "viewed"}
          viewedAt={latestRequest.viewed_at}
          sentAt={latestRequest.notification_sent_at}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCheckStatus}
                disabled={checkStatusMutation.isPending}
              >
                {checkStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Check E-Sign status</p>
            </TooltipContent>
          </Tooltip>

          {/* Resend Link Button */}
          {latestRequest.signer_url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResendLink}
                  disabled={isResendingLink}
                >
                  {isResendingLink ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Resend signing link via WhatsApp & Email</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Resend E-Sign Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDialogOpen(true)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Create new E-Sign request</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ESignDocumentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          orgId={orgId}
          applicationId={applicationId}
          documentId={documentId}
          documentType={documentType}
          documentLabel={documentLabel}
          defaultSignerName={signerName}
          defaultSignerEmail={signerEmail}
          defaultSignerMobile={signerMobile}
          environment={environment}
          onSuccess={onSuccess}
        />
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
        title="Send for E-Sign"
      >
        <FileSignature className="h-4 w-4 mr-2" />
        E-Sign
      </Button>

      <ESignDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        applicationId={applicationId}
        documentId={documentId}
        documentType={documentType}
        documentLabel={documentLabel}
        defaultSignerName={signerName}
        defaultSignerEmail={signerEmail}
        defaultSignerMobile={signerMobile}
        environment={environment}
        onSuccess={onSuccess}
      />
    </>
  );
}
