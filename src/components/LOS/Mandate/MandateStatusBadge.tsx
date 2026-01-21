import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send, 
  AlertCircle,
  Ban
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MandateStatus = "pending" | "submitted" | "accepted" | "rejected" | "expired" | "cancelled";

interface MandateStatusBadgeProps {
  status: MandateStatus;
  rejectionReasonCode?: string;
  rejectionReasonDesc?: string;
  rejectedBy?: string;
  className?: string;
}

const statusConfig: Record<MandateStatus, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
  className: string;
}> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  submitted: {
    label: "Submitted",
    variant: "secondary",
    icon: <Send className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  accepted: {
    label: "Active",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    icon: <XCircle className="h-3 w-3" />,
    className: "bg-red-100 text-red-800 border-red-200",
  },
  expired: {
    label: "Expired",
    variant: "outline",
    icon: <AlertCircle className="h-3 w-3" />,
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
  cancelled: {
    label: "Cancelled",
    variant: "outline",
    icon: <Ban className="h-3 w-3" />,
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
};

// Common rejection reason codes
const rejectionReasons: Record<string, string> = {
  "AP30": "Browser closed by customer",
  "AP46": "No response from customer",
  "AP47": "Customer declined",
  "AP48": "Invalid bank account",
  "AP49": "Account blocked/inactive",
  "000": "Success",
};

export default function MandateStatusBadge({
  status,
  rejectionReasonCode,
  rejectionReasonDesc,
  rejectedBy,
  className = "",
}: MandateStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  
  const badge = (
    <Badge 
      variant={config.variant}
      className={`${config.className} flex items-center gap-1 ${className}`}
    >
      {config.icon}
      {config.label}
    </Badge>
  );

  // Show tooltip for rejected status with reason
  if (status === "rejected" && (rejectionReasonCode || rejectionReasonDesc)) {
    const reasonText = rejectionReasonDesc || rejectionReasons[rejectionReasonCode || ""] || rejectionReasonCode;
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="text-sm">
            <p className="font-medium">Rejection Reason</p>
            <p className="text-muted-foreground">{reasonText}</p>
            {rejectedBy && rejectedBy !== "N/A" && (
              <p className="text-xs text-muted-foreground mt-1">
                Rejected by: {rejectedBy}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
