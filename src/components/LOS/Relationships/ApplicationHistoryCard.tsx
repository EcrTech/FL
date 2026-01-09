import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoanApplicationSummary } from "@/hooks/useCustomerRelationships";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ApplicationHistoryCardProps {
  application: LoanApplicationSummary;
}

const stageLabels: Record<string, string> = {
  application_login: "Application Login",
  document_collection: "Document Collection",
  verification: "Verification",
  credit_assessment: "Credit Assessment",
  approval_pending: "Approval Pending",
  approved: "Approved",
  rejected: "Rejected",
  sanctioned: "Sanctioned",
  agreement_pending: "Agreement Pending",
  disbursement_pending: "Disbursement Pending",
  disbursed: "Disbursed",
  closed: "Closed",
};

const stageBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  application_login: "outline",
  document_collection: "outline",
  verification: "secondary",
  credit_assessment: "secondary",
  approval_pending: "secondary",
  approved: "default",
  rejected: "destructive",
  sanctioned: "default",
  agreement_pending: "secondary",
  disbursement_pending: "secondary",
  disbursed: "default",
  closed: "outline",
};

export function ApplicationHistoryCard({ application }: ApplicationHistoryCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const navigate = useNavigate();

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd MMM yyyy");
  };

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-sm font-medium">
                {application.loanId || application.applicationNumber}
              </CardTitle>
              {application.loanId && (
                <p className="text-xs text-muted-foreground">{application.applicationNumber}</p>
              )}
            </div>
            <Badge variant={stageBadgeVariants[application.currentStage] || "outline"}>
              {stageLabels[application.currentStage] || application.currentStage}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/los/applications/${application.applicationId}`)}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Requested</p>
            <p className="font-medium">{formatCurrency(application.requestedAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Disbursed</p>
            <p className="font-medium">{formatCurrency(application.disbursedAmount || null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Paid</p>
            <p className="font-medium text-green-600">{formatCurrency(application.totalPaid)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Outstanding</p>
            <p className="font-medium text-orange-600">{formatCurrency(application.totalOutstanding)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t">
          <div>
            <p className="text-muted-foreground text-xs">Application Date</p>
            <p>{formatDate(application.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Sanction Date</p>
            <p>{formatDate(application.sanctionDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Disbursement Date</p>
            <p>{formatDate(application.disbursementDate)}</p>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 space-y-4">
            {/* EMI Schedule */}
            {application.emiSchedule.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">EMI Schedule</h4>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">EMI #</TableHead>
                        <TableHead className="text-xs">Due Date</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Paid Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {application.emiSchedule.map((emi) => (
                        <TableRow key={emi.id}>
                          <TableCell className="text-xs">{emi.emi_number}</TableCell>
                          <TableCell className="text-xs">{formatDate(emi.due_date)}</TableCell>
                          <TableCell className="text-xs text-right">
                            {formatCurrency(emi.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                emi.status === "paid"
                                  ? "default"
                                  : emi.status === "overdue"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {emi.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(emi.paid_date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Payments */}
            {application.payments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Payment History</h4>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Mode</TableHead>
                        <TableHead className="text-xs">Reference</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {application.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-xs">
                            {formatDate(payment.payment_date)}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {formatCurrency(payment.payment_amount)}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {payment.payment_mode?.replace("_", " ")}
                          </TableCell>
                          <TableCell className="text-xs">
                            {payment.reference_number || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={payment.status === "completed" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {application.emiSchedule.length === 0 && application.payments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No EMI schedule or payments recorded yet.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
