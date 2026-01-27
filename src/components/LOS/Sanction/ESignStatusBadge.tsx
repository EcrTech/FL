import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Eye, CheckCircle, XCircle, AlertCircle, Send } from "lucide-react";
import { format } from "date-fns";

interface ESignStatusBadgeProps {
  status: "pending" | "sent" | "viewed" | "signed" | "expired" | "failed";
  signedAt?: string | null;
  viewedAt?: string | null;
  sentAt?: string | null;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  sent: {
    label: "Sent",
    icon: Send,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  viewed: {
    label: "Viewed",
    icon: Eye,
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  signed: {
    label: "Signed",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  expired: {
    label: "Expired",
    icon: AlertCircle,
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

export default function ESignStatusBadge({ status, signedAt, viewedAt, sentAt }: ESignStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  const tooltipContent = () => {
    const lines: string[] = [];
    
    if (sentAt) {
      lines.push(`Sent: ${format(new Date(sentAt), "MMM dd, yyyy HH:mm")}`);
    }
    
    if (viewedAt) {
      lines.push(`Viewed: ${format(new Date(viewedAt), "MMM dd, yyyy HH:mm")}`);
    }
    
    if (signedAt) {
      lines.push(`Signed: ${format(new Date(signedAt), "MMM dd, yyyy HH:mm")}`);
    }
    
    return lines.length > 0 ? lines.join("\n") : `Status: ${config.label}`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 ${config.className}`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line text-xs">{tooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
