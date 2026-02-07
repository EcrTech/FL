import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Video, AlertTriangle } from "lucide-react";
import { VideoKYCRetryButton } from "./VideoKYCRetryButton";

interface VideoKYCViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingUrl: string;
  applicantName?: string;
  completedAt?: string;
  applicationId: string;
  orgId: string;
  applicantPhone?: string;
  applicantEmail?: string;
}

export function VideoKYCViewDialog({
  open,
  onOpenChange,
  recordingUrl,
  applicantName,
  completedAt,
  applicationId,
  orgId,
  applicantPhone,
  applicantEmail,
}: VideoKYCViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video KYC Recording
          </DialogTitle>
          <DialogDescription>
            {applicantName && `Recording from ${applicantName}`}
            {completedAt && ` - Completed on ${new Date(completedAt).toLocaleDateString()}`}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={recordingUrl}
              controls
              playsInline
              preload="auto"
              className="w-full h-full object-contain"
              autoPlay={false}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Retry Link Section */}
          <div className="mt-4 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Video incorrect? Request a new recording.</span>
            </div>
            <VideoKYCRetryButton
              applicationId={applicationId}
              orgId={orgId}
              applicantName={applicantName || "Applicant"}
              applicantPhone={applicantPhone}
              applicantEmail={applicantEmail}
              showTrigger={true}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
