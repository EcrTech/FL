import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Video } from "lucide-react";

interface VideoKYCViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingUrl: string;
  applicantName?: string;
  completedAt?: string;
}

export function VideoKYCViewDialog({
  open,
  onOpenChange,
  recordingUrl,
  applicantName,
  completedAt,
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
              className="w-full h-full object-contain"
              autoPlay={false}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
