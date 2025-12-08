import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Clock, FileText, User, Building, CreditCard, Video } from "lucide-react";
import { format } from "date-fns";

interface VerificationDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  verification: any;
  verificationType: {
    type: string;
    name: string;
    description: string;
  };
}

const STATUS_CONFIG = {
  pending: { color: "bg-muted", icon: Clock, label: "Pending", textColor: "text-muted-foreground" },
  in_progress: { color: "bg-blue-500", icon: Clock, label: "In Progress", textColor: "text-blue-600" },
  success: { color: "bg-green-500", icon: CheckCircle, label: "Verified", textColor: "text-green-600" },
  failed: { color: "bg-red-500", icon: XCircle, label: "Failed", textColor: "text-red-600" },
};

const TYPE_ICONS: Record<string, any> = {
  pan: FileText,
  aadhaar: User,
  bank_account: Building,
  employment: Building,
  credit_bureau: CreditCard,
  bank_statement: FileText,
  video_kyc: Video,
};

export default function VerificationDetailsDialog({
  open,
  onClose,
  verification,
  verificationType,
}: VerificationDetailsDialogProps) {
  if (!verification) return null;

  const status = verification.status || "pending";
  const StatusIcon = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.icon || Clock;
  const TypeIcon = TYPE_ICONS[verificationType.type] || FileText;

  const renderValue = (value: any, key: string): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">N/A</span>;
    
    if (typeof value === "boolean") {
      return value ? (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Yes</Badge>
      ) : (
        <Badge variant="secondary">No</Badge>
      );
    }
    
    if (typeof value === "object" && !Array.isArray(value)) {
      return (
        <div className="mt-2 pl-4 border-l-2 border-muted space-y-2">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <span className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
              <span className="text-sm font-medium">{renderValue(v, k)}</span>
            </div>
          ))}
        </div>
      );
    }
    
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {typeof item === "object" ? JSON.stringify(item) : String(item)}
            </Badge>
          ))}
        </div>
      );
    }

    // Format dates
    if (key.includes("date") || key.includes("_at") || key.includes("dob")) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return format(date, "MMM dd, yyyy HH:mm");
        }
      } catch {}
    }

    // Format status/match values with badges
    if (key.includes("status") || key.includes("match") || key.includes("check")) {
      const isPositive = ["valid", "verified", "exact", "passed", "active", "employed", "success", "true"].includes(
        String(value).toLowerCase()
      );
      const isNegative = ["invalid", "failed", "rejected", "inactive", "false"].includes(
        String(value).toLowerCase()
      );
      
      return (
        <Badge 
          className={
            isPositive 
              ? "bg-green-500/10 text-green-600 border-green-500/20" 
              : isNegative 
                ? "bg-red-500/10 text-red-600 border-red-500/20"
                : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
          }
        >
          {String(value)}
        </Badge>
      );
    }

    return String(value);
  };

  const renderDataSection = (title: string, data: Record<string, any> | null) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="py-4 text-center text-muted-foreground text-sm">
          No data available
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {key.replace(/_/g, " ")}
            </span>
            <div className="text-sm">{renderValue(value, key)}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TypeIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                {verificationType.name}
                <Badge className={STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color}>
                  {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label}
                </Badge>
              </DialogTitle>
              <DialogDescription>{verificationType.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Verification Meta */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <span className="text-xs text-muted-foreground">Verification ID</span>
                <p className="text-sm font-mono">{verification.id?.slice(0, 8)}...</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Source</span>
                <p className="text-sm font-medium">{verification.verification_source || "N/A"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Created</span>
                <p className="text-sm">
                  {verification.created_at
                    ? format(new Date(verification.created_at), "MMM dd, yyyy HH:mm")
                    : "N/A"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Verified At</span>
                <p className="text-sm">
                  {verification.verified_at
                    ? format(new Date(verification.verified_at), "MMM dd, yyyy HH:mm")
                    : "Not verified yet"}
                </p>
              </div>
            </div>

            {/* Request Data */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Request Data (Input)
              </h4>
              <div className="p-4 border rounded-lg bg-background">
                {renderDataSection("Request", verification.request_data as Record<string, any>)}
              </div>
            </div>

            <Separator />

            {/* Response Data */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Response Data (Matched/Verified)
              </h4>
              <div className="p-4 border rounded-lg bg-background">
                {renderDataSection("Response", verification.response_data as Record<string, any>)}
              </div>
            </div>

            {/* Remarks */}
            {verification.remarks && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">Remarks</h4>
                  <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                    {verification.remarks}
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
