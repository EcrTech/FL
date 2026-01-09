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
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  FileText,
  RefreshCw,
  IndianRupee,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CustomerRelationship } from "@/hooks/useCustomerRelationships";
import { ApplicationHistoryCard } from "./ApplicationHistoryCard";

interface CustomerDetailDialogProps {
  customer: CustomerRelationship | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const scoreColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 border-green-200",
  good: "bg-blue-100 text-blue-800 border-blue-200",
  fair: "bg-yellow-100 text-yellow-800 border-yellow-200",
  poor: "bg-red-100 text-red-800 border-red-200",
};

export function CustomerDetailDialog({ 
  customer, 
  open, 
  onOpenChange 
}: CustomerDetailDialogProps) {
  const navigate = useNavigate();

  if (!customer) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCreateReapplication = () => {
    // Get the most recent application's data for prefilling
    const latestApp = customer.applications[0];
    
    navigate("/los/applications/new", {
      state: {
        prefillData: {
          pan_number: customer.panNumber,
          mobile: customer.mobile,
          name: customer.name,
          email: customer.email,
          isReapplication: true,
          previousApplicationId: latestApp?.applicationId,
        },
      },
    });
    onOpenChange(false);
  };

  // Calculate payment summary
  const paymentSummary = {
    totalEmis: 0,
    paidOnTime: 0,
    paidLate: 0,
    overdue: 0,
    pending: 0,
  };

  customer.applications.forEach(app => {
    app.emiSchedule.forEach(emi => {
      paymentSummary.totalEmis++;
      if (emi.status === 'paid') {
        if (emi.paid_date && new Date(emi.paid_date) <= new Date(emi.due_date)) {
          paymentSummary.paidOnTime++;
        } else {
          paymentSummary.paidLate++;
        }
      } else if (emi.status === 'overdue') {
        paymentSummary.overdue++;
      } else {
        paymentSummary.pending++;
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Customer Details</span>
            <Button onClick={handleCreateReapplication}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Create Reapplication
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Customer Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer ID</p>
                    <p className="font-medium">{customer.customerId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{customer.name}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CreditCard className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">PAN</p>
                      <p className="font-medium">{customer.panNumber}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Aadhaar</p>
                    <p className="font-medium">{customer.aadhaarNumber}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Mobile</p>
                      <p className="font-medium">{customer.mobile}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{customer.email || "—"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Score</p>
                    <Badge className={`${scoreColors[customer.paymentScore]} mt-1`}>
                      {customer.paymentScore.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Application</p>
                    <p className="font-medium">
                      {customer.lastApplicationDate 
                        ? format(new Date(customer.lastApplicationDate), "dd MMM yyyy")
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{customer.totalLoans}</p>
                      <p className="text-xs text-muted-foreground">Total Loans</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{customer.activeLoans}</p>
                      <p className="text-xs text-muted-foreground">Active Loans</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(customer.totalDisbursed)}</p>
                      <p className="text-xs text-muted-foreground">Total Disbursed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(customer.outstandingAmount)}</p>
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Summary */}
            {paymentSummary.totalEmis > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Payment Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{paymentSummary.totalEmis}</p>
                      <p className="text-xs text-muted-foreground">Total EMIs</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{paymentSummary.paidOnTime}</p>
                      <p className="text-xs text-muted-foreground">Paid On Time</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">{paymentSummary.paidLate}</p>
                      <p className="text-xs text-muted-foreground">Paid Late</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{paymentSummary.overdue}</p>
                      <p className="text-xs text-muted-foreground">Overdue</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{paymentSummary.pending}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Application History */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application History ({customer.applications.length})
              </h3>
              <div className="space-y-3">
                {customer.applications.map((app) => (
                  <ApplicationHistoryCard key={app.applicationId} application={app} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
