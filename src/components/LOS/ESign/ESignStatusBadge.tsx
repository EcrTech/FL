import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Eye, Send, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ESignStatusBadgeProps {
  status: 'pending' | 'viewed' | 'otp_sent' | 'signed' | 'expired' | 'failed' | string;
  signedAt?: string;
  className?: string;
}

export function ESignStatusBadge({ status, signedAt, className }: ESignStatusBadgeProps) {
  const statusConfig: Record<string, { 
    label: string; 
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
    description: string;
  }> = {
    pending: {
      label: "Pending",
      variant: "outline",
      icon: <Clock className="h-3 w-3" />,
      description: "Signing link sent, awaiting action"
    },
    viewed: {
      label: "Viewed",
      variant: "secondary",
      icon: <Eye className="h-3 w-3" />,
      description: "Applicant has viewed the document"
    },
    otp_sent: {
      label: "OTP Sent",
      variant: "secondary",
      icon: <Send className="h-3 w-3" />,
      description: "OTP sent for verification"
    },
    signed: {
      label: "Signed",
      variant: "default",
      icon: <CheckCircle2 className="h-3 w-3" />,
      description: signedAt 
        ? `Signed on ${new Date(signedAt).toLocaleDateString('en-IN')}`
        : "Document has been signed"
    },
    expired: {
      label: "Expired",
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3" />,
      description: "Signing link has expired"
    },
    failed: {
      label: "Failed",
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3" />,
      description: "Signing failed, please retry"
    }
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={config.variant} 
            className={`gap-1 cursor-help ${className || ''}`}
          >
            {config.icon}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
