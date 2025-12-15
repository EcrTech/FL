import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Shield,
  Calculator,
  ArrowRight,
  FilePlus,
} from "lucide-react";

interface ApprovalHistoryProps {
  applicationId: string;
}

interface TimelineEvent {
  id: string;
  type: "application" | "document" | "verification" | "eligibility" | "stage" | "approval";
  title: string;
  description?: string;
  status?: "success" | "pending" | "failed";
  timestamp: string;
  actor?: string;
}

export default function ApprovalHistory({ applicationId }: ApprovalHistoryProps) {
  const { data: timeline, isLoading } = useQuery({
    queryKey: ["case-history", applicationId],
    queryFn: async () => {
      const events: TimelineEvent[] = [];

      // 1. Fetch application creation
      const { data: application } = await supabase
        .from("loan_applications")
        .select("id, created_at, status, current_stage, approved_by, updated_at")
        .eq("id", applicationId)
        .maybeSingle();

      if (application) {
        events.push({
          id: `app-created-${application.id}`,
          type: "application",
          title: "Application Created",
          description: "Loan application submitted",
          status: "success",
          timestamp: application.created_at,
        });
      }

      // 2. Fetch document uploads
      const { data: documents } = await supabase
        .from("loan_documents")
        .select("id, document_type, created_at")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: true });

      if (documents) {
        documents.forEach((doc) => {
          events.push({
            id: `doc-${doc.id}`,
            type: "document",
            title: "Document Uploaded",
            description: formatDocumentType(doc.document_type),
            status: "success",
            timestamp: doc.created_at,
          });
        });
      }

      // 3. Fetch verifications
      const { data: verifications } = await supabase
        .from("loan_verifications")
        .select("id, verification_type, status, created_at, updated_at")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: true });

      if (verifications) {
        verifications.forEach((v) => {
          events.push({
            id: `ver-${v.id}`,
            type: "verification",
            title: `${formatVerificationType(v.verification_type)} Verification`,
            description: v.status === "success" ? "Verified successfully" : v.status === "pending" ? "Pending verification" : "Verification failed",
            status: v.status as "success" | "pending" | "failed",
            timestamp: v.updated_at || v.created_at,
          });
        });
      }

      // 4. Fetch eligibility calculations
      const { data: eligibility } = await supabase
        .from("loan_eligibility")
        .select("id, is_eligible, calculation_date, created_at")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: true });

      if (eligibility) {
        eligibility.forEach((e) => {
          events.push({
            id: `elig-${e.id}`,
            type: "eligibility",
            title: "Eligibility Calculated",
            description: e.is_eligible ? "Applicant is eligible" : "Applicant not eligible",
            status: e.is_eligible ? "success" : "failed",
            timestamp: e.calculation_date || e.created_at,
          });
        });
      }

      // 5. Fetch stage changes
      const { data: stageHistory } = await supabase
        .from("loan_stage_history")
        .select(`
          id, 
          from_stage, 
          to_stage, 
          moved_at, 
          reason, 
          comments,
          moved_by_profile:profiles!loan_stage_history_moved_by_fkey(first_name, last_name)
        `)
        .eq("loan_application_id", applicationId)
        .order("moved_at", { ascending: true });

      if (stageHistory) {
        stageHistory.forEach((s: any) => {
          const actorName = s.moved_by_profile
            ? [s.moved_by_profile.first_name, s.moved_by_profile.last_name].filter(Boolean).join(" ")
            : undefined;
          events.push({
            id: `stage-${s.id}`,
            type: "stage",
            title: "Stage Changed",
            description: `${formatStageName(s.from_stage)} → ${formatStageName(s.to_stage)}`,
            status: s.to_stage === "approved" ? "success" : s.to_stage === "rejected" ? "failed" : "pending",
            timestamp: s.moved_at,
            actor: actorName,
          });
        });
      }

      // 6. Fetch approval actions
      const { data: approvals } = await supabase
        .from("loan_approvals")
        .select(`
          id,
          approval_status,
          comments,
          created_at,
          profiles:approver_id(first_name, last_name)
        `)
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: true });

      if (approvals) {
        approvals.forEach((a: any) => {
          const actorName = a.profiles
            ? [a.profiles.first_name, a.profiles.last_name].filter(Boolean).join(" ")
            : undefined;
          events.push({
            id: `approval-${a.id}`,
            type: "approval",
            title: a.approval_status === "approved" ? "Application Approved" : a.approval_status === "rejected" ? "Application Rejected" : "Approval Pending",
            description: a.comments || undefined,
            status: a.approval_status === "approved" ? "success" : a.approval_status === "rejected" ? "failed" : "pending",
            timestamp: a.created_at,
            actor: actorName,
          });
        });
      }

      // Sort by timestamp ascending
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return events;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading case history...</div>
        </CardContent>
      </Card>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Case History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No case history available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Case History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {timeline.map((event, index) => (
              <div key={event.id} className="relative flex gap-4 pl-10">
                {/* Icon */}
                <div className="absolute left-0 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 border-border">
                  {getEventIcon(event)}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{event.title}</span>
                    {event.status && (
                      <Badge
                        variant={
                          event.status === "success"
                            ? "default"
                            : event.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {event.status}
                      </Badge>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{format(new Date(event.timestamp), "dd MMM yyyy, hh:mm a")}</span>
                    {event.actor && <span>• by {event.actor}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getEventIcon(event: TimelineEvent) {
  const iconClass = "h-4 w-4";
  switch (event.type) {
    case "application":
      return <FilePlus className={`${iconClass} text-blue-600`} />;
    case "document":
      return <FileText className={`${iconClass} text-purple-600`} />;
    case "verification":
      return <Shield className={`${iconClass} text-orange-600`} />;
    case "eligibility":
      return <Calculator className={`${iconClass} text-indigo-600`} />;
    case "stage":
      return <ArrowRight className={`${iconClass} text-cyan-600`} />;
    case "approval":
      return event.status === "success" ? (
        <CheckCircle className={`${iconClass} text-green-600`} />
      ) : event.status === "failed" ? (
        <XCircle className={`${iconClass} text-red-600`} />
      ) : (
        <Clock className={`${iconClass} text-yellow-600`} />
      );
    default:
      return <Clock className={iconClass} />;
  }
}

function formatDocumentType(type: string): string {
  const map: Record<string, string> = {
    pan_card: "PAN Card",
    aadhaar_card: "Aadhaar Card",
    salary_slip_1: "Salary Slip 1",
    salary_slip_2: "Salary Slip 2",
    salary_slip_3: "Salary Slip 3",
    bank_statement: "Bank Statement",
    address_proof: "Address Proof",
    photo: "Photograph",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatVerificationType(type: string): string {
  const map: Record<string, string> = {
    pan: "PAN",
    aadhaar: "Aadhaar",
    bank_account: "Bank Account",
    bank_statement: "Bank Statement",
    employment: "Employment",
    credit_bureau: "Credit Bureau",
    video_kyc: "Video KYC",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStageName(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
