import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSignature, RefreshCw, Loader2 } from "lucide-react";
import ESignDocumentDialog from "./ESignDocumentDialog";
import ESignStatusBadge from "./ESignStatusBadge";
import { useESignRequests, useCheckESignStatus } from "@/hooks/useESignDocument";
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
      <div className="flex items-center gap-2">
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
        </TooltipProvider>
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
