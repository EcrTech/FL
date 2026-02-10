import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";

interface Finding {
  document_type: string;
  risk_level: string;
  confidence?: number;
  issues: string[];
  details?: string;
}

interface CrossCheck {
  check: string;
  status: "pass" | "fail" | "warning";
  detail: string;
}

interface FraudCheckResult {
  overall_risk: string;
  risk_score: number;
  documents_analyzed: number;
  findings: Finding[];
  cross_document_checks: CrossCheck[];
  analyzed_at: string;
}

interface FraudCheckResultCardProps {
  result: FraudCheckResult;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  pan_card: "PAN Card",
  aadhaar_front: "Aadhaar (Front)",
  aadhaar_back: "Aadhaar (Back)",
  photo: "Passport Photo",
  rental_agreement: "Rental Agreement",
  utility_bill: "Utility Bill",
  salary_slip_1: "Salary Slip 1",
  salary_slip_2: "Salary Slip 2",
  salary_slip_3: "Salary Slip 3",
  form_16_year_1: "Form 16 (Current)",
  form_16_year_2: "Form 16 (Previous)",
  itr_year_1: "ITR (Current)",
  itr_year_2: "ITR (Previous)",
  bank_statement: "Bank Statement",
  offer_letter: "Offer Letter",
  employee_id: "Employee ID",
};

export default function FraudCheckResultCard({ result }: FraudCheckResultCardProps) {
  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "high":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <ShieldX className="h-3 w-3" /> High Risk
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1">
            <ShieldAlert className="h-3 w-3" /> Medium Risk
          </Badge>
        );
      case "low":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
            <ShieldCheck className="h-3 w-3" /> Low Risk
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" /> Unknown
          </Badge>
        );
    }
  };

  const getCheckStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "fail":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Shield className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const flaggedFindings = result.findings.filter(
    (f) => f.risk_level === "high" || f.risk_level === "medium"
  );

  return (
    <Card className="border-border">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            AI Fraud Check
          </CardTitle>
          <div className="flex items-center gap-2">
            {getRiskBadge(result.overall_risk)}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {result.analyzed_at
                ? format(new Date(result.analyzed_at), "dd MMM yyyy, HH:mm")
                : "N/A"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {/* Summary */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Score:</span>
            <span className="font-medium">{result.risk_score}/100</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Documents:</span>
            <span className="font-medium">{result.documents_analyzed}</span>
          </div>
          {flaggedFindings.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Flagged:</span>
              <span className="font-medium text-destructive">{flaggedFindings.length}</span>
            </div>
          )}
        </div>

        {/* Cross-document checks */}
        {result.cross_document_checks.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Cross-Document Checks
            </span>
            <div className="space-y-1">
              {result.cross_document_checks.map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {getCheckStatusIcon(check.status)}
                  <span className="font-medium">{check.check}:</span>
                  <span className="text-muted-foreground">{check.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-document findings */}
        {flaggedFindings.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="findings" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  {flaggedFindings.length} Document{flaggedFindings.length > 1 ? "s" : ""} Flagged
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-1 space-y-2">
                {flaggedFindings.map((finding, i) => (
                  <div key={i} className="rounded-md border border-border p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {DOCUMENT_TYPE_LABELS[finding.document_type] || finding.document_type}
                      </span>
                      {getRiskBadge(finding.risk_level)}
                    </div>
                    {finding.issues.length > 0 && (
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                        {finding.issues.map((issue, j) => (
                          <li key={j}>{issue}</li>
                        ))}
                      </ul>
                    )}
                    {finding.details && (
                      <p className="text-xs text-muted-foreground">{finding.details}</p>
                    )}
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {flaggedFindings.length === 0 && result.cross_document_checks.every((c) => c.status === "pass") && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <ShieldCheck className="h-4 w-4" />
            No issues detected. All documents appear authentic.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
