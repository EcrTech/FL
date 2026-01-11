import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Banknote, 
  ExternalLink,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Calendar,
  IndianRupee,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LoanListItem } from "@/hooks/useLoansList";

interface LoanDetailDialogProps {
  loan: LoanListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  on_track: { label: "On Track", color: "bg-green-100 text-green-800", icon: <TrendingUp className="h-3 w-3" /> },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-800", icon: <CheckCircle className="h-3 w-3" /> },
};

export function LoanDetailDialog({ loan, open, onOpenChange }: LoanDetailDialogProps) {
  const navigate = useNavigate();

  if (!loan) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const status = statusConfig[loan.paymentStatus];
  const emiProgressPercent = loan.emiCount > 0 ? Math.round((loan.paidEmiCount / loan.emiCount) * 100) : 0;

  const handleViewApplication = () => {
    navigate(`/los/applications/${loan.applicationId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Loan {loan.loanId}
            </span>
            <Button onClick={handleViewApplication} size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              View Application
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Status Badge */}
            <Badge className={status.color}>
              <span className="flex items-center gap-1">
                {status.icon}
                {status.label}
              </span>
            </Badge>

            {/* EMI Progress */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">EMI Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>{loan.paidEmiCount} of {loan.emiCount} EMIs paid</span>
                  <span>{emiProgressPercent}%</span>
                </div>
                <Progress value={emiProgressPercent} className="h-3" />
                {loan.overdueEmiCount > 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    {loan.overdueEmiCount} overdue EMI{loan.overdueEmiCount > 1 ? 's' : ''}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Borrower Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Borrower Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{loan.applicantName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">PAN</p>
                    <p className="font-medium font-mono">{loan.panNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mobile</p>
                    <p className="font-medium">{loan.mobile}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Application</p>
                    <p className="font-medium font-mono">{loan.applicationNumber}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sanctioned Amount</p>
                    <p className="font-semibold">{formatCurrency(loan.sanctionedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Disbursed Amount</p>
                    <p className="font-semibold text-primary">{formatCurrency(loan.disbursedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total EMI Amount</p>
                    <p className="font-medium">{formatCurrency(loan.totalEmiAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Paid</p>
                    <p className="font-semibold text-green-600">{formatCurrency(loan.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Outstanding</p>
                    <p className={`font-semibold ${loan.outstandingAmount > 0 ? 'text-orange-600' : ''}`}>
                      {formatCurrency(loan.outstandingAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">On-Time Payment</p>
                    <p className="font-medium">{loan.onTimePaymentPercent}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next Due */}
            {loan.nextDueDate && loan.nextDueAmount && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Next EMI Due</p>
                        <p className="font-medium">{format(new Date(loan.nextDueDate), "dd MMM yyyy")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-700">{formatCurrency(loan.nextDueAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Disbursement Date */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Loan Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Disbursement Date</p>
                    <p className="font-medium">
                      {loan.disbursementDate ? format(new Date(loan.disbursementDate), "dd MMM yyyy") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tenure</p>
                    <p className="font-medium">{loan.tenureDays} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
