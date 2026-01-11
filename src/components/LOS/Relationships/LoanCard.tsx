import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Eye,
  Banknote,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { LoanListItem } from "@/hooks/useLoansList";

interface LoanCardProps {
  loan: LoanListItem;
  onViewDetails: (loan: LoanListItem) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  on_track: { 
    label: "On Track", 
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <TrendingUp className="h-3 w-3" />
  },
  overdue: { 
    label: "Overdue", 
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <AlertCircle className="h-3 w-3" />
  },
  completed: { 
    label: "Completed", 
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <CheckCircle className="h-3 w-3" />
  },
};

export function LoanCard({ loan, onViewDetails }: LoanCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const status = statusConfig[loan.paymentStatus];
  const emiProgressPercent = loan.emiCount > 0 
    ? Math.round((loan.paidEmiCount / loan.emiCount) * 100)
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Loan Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                <span className="font-mono font-semibold text-foreground">
                  {loan.loanId}
                </span>
              </div>
              <Badge className={status.color}>
                <span className="flex items-center gap-1">
                  {status.icon}
                  {status.label}
                </span>
              </Badge>
            </div>

            {/* Applicant Info */}
            <div className="text-sm text-muted-foreground mb-3">
              <span className="font-medium text-foreground">{loan.applicantName}</span>
              <span className="mx-2">•</span>
              <span className="font-mono">{loan.panNumber}</span>
              <span className="mx-2">•</span>
              <span>{loan.mobile}</span>
            </div>

            {/* EMI Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>EMI Progress ({loan.paidEmiCount} of {loan.emiCount})</span>
                <span>{emiProgressPercent}%</span>
              </div>
              <Progress value={emiProgressPercent} className="h-2" />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Disbursed</p>
                <p className="font-semibold">{formatCurrency(loan.disbursedAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="font-semibold text-green-600">{formatCurrency(loan.totalPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className={`font-semibold ${loan.outstandingAmount > 0 ? 'text-orange-600' : ''}`}>
                  {formatCurrency(loan.outstandingAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Next Due & Actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {loan.nextDueDate && loan.nextDueAmount ? (
              <div className="text-right p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Next Due
                </p>
                <p className="font-semibold text-primary">
                  {formatCurrency(loan.nextDueAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(loan.nextDueDate), "dd MMM yyyy")}
                </p>
              </div>
            ) : (
              <div className="text-right p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  All Paid
                </p>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(loan)}
              className="mt-2"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>App: {loan.applicationNumber}</span>
            <span>Tenure: {loan.tenureDays} days</span>
            {loan.overdueEmiCount > 0 && (
              <span className="text-red-600 font-medium">
                {loan.overdueEmiCount} overdue EMI{loan.overdueEmiCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span>On-time: {loan.onTimePaymentPercent}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
