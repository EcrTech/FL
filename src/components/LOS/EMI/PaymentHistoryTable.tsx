import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEMIPayments } from "@/hooks/useEMIPayments";
import { DollarSign } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";

interface PaymentHistoryTableProps {
  applicationId: string;
}

export default function PaymentHistoryTable({ applicationId }: PaymentHistoryTableProps) {
  const { payments, isLoading } = useEMIPayments(applicationId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getPaymentMethodBadge = (method: string) => {
    const methodConfig: Record<string, string> = {
      cash: "Cash",
      cheque: "Cheque",
      neft: "NEFT",
      rtgs: "RTGS",
      imps: "IMPS",
      upi: "UPI",
      card: "Card",
    };

    return <Badge variant="outline">{methodConfig[method] || method}</Badge>;
  };

  if (isLoading) {
    return <LoadingState message="Loading payment history..." />;
  }

  if (!payments || payments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No payments recorded yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.payment_number}</TableCell>
                  <TableCell>{formatDate(payment.payment_date)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(payment.payment_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(payment.principal_paid)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(payment.interest_paid)}
                  </TableCell>
                  <TableCell>{getPaymentMethodBadge(payment.payment_method)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.transaction_reference || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {payment.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Payments</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(payments.reduce((sum, p) => sum + p.payment_amount, 0))}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
