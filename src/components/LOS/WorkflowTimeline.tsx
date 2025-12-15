import { CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowTimelineProps {
  currentStage: string;
  status: string;
}

const WORKFLOW_STAGES = [
  { key: "application_login", label: "Application Login" },
  { key: "document_collection", label: "Document Collection" },
  { key: "field_verification", label: "Field Verification" },
  { key: "credit_assessment", label: "Credit Assessment" },
  { key: "approval_pending", label: "Approval Pending" },
  { key: "sanctioned", label: "Sanctioned" },
  { key: "disbursement_pending", label: "Disbursement Pending" },
  { key: "disbursed", label: "Disbursed" },
];

export default function WorkflowTimeline({ currentStage, status }: WorkflowTimelineProps) {
  const isRejected = currentStage === "rejected" || status === "rejected";
  const isCancelled = currentStage === "cancelled";
  const isClosed = currentStage === "closed";

  const getCurrentStageIndex = () => {
    return WORKFLOW_STAGES.findIndex((stage) => stage.key === currentStage);
  };

  const currentIndex = getCurrentStageIndex();

  const getStageStatus = (index: number) => {
    if (isRejected || isCancelled) {
      if (index < currentIndex) return "completed";
      if (index === currentIndex) return "rejected";
      return "pending";
    }
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "current";
    return "pending";
  };

  if (isRejected || isCancelled || isClosed) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <XCircle className="h-5 w-5 text-destructive" />
        <span className="font-medium text-destructive">
          Application {isRejected ? "Rejected" : isCancelled ? "Cancelled" : "Closed"}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-max py-2">
        {WORKFLOW_STAGES.map((stage, index) => {
          const stageStatus = getStageStatus(index);
          const isLast = index === WORKFLOW_STAGES.length - 1;

          return (
            <div key={stage.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                    stageStatus === "completed" && "bg-primary border-primary text-primary-foreground",
                    stageStatus === "current" && "bg-primary/20 border-primary text-primary",
                    stageStatus === "pending" && "bg-muted border-muted-foreground/30 text-muted-foreground",
                    stageStatus === "rejected" && "bg-destructive border-destructive text-destructive-foreground"
                  )}
                >
                  {stageStatus === "completed" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : stageStatus === "current" ? (
                    <Clock className="h-4 w-4" />
                  ) : stageStatus === "rejected" ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs mt-1.5 text-center max-w-[80px] leading-tight",
                    stageStatus === "completed" && "text-primary font-medium",
                    stageStatus === "current" && "text-primary font-semibold",
                    stageStatus === "pending" && "text-muted-foreground",
                    stageStatus === "rejected" && "text-destructive font-medium"
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-1 mt-[-20px]",
                    index < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
