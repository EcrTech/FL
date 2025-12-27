import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollectionRecord } from "@/hooks/useCollections";
import { IndianRupee } from "lucide-react";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CollectionRecord | null;
  onSubmit: (data: {
    scheduleId: string;
    applicationId: string;
    paymentDate: string;
    paymentAmount: number;
    principalPaid: number;
    interestPaid: number;
    lateFeePaid: number;
    paymentMethod: string;
    transactionReference?: string;
    notes?: string;
  }) => void;
  isSubmitting: boolean;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  record,
  onSubmit,
  isSubmitting,
}: RecordPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("upi");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    const amount = parseFloat(paymentAmount) || 0;
    const remaining = record.total_emi - record.amount_paid;
    const principalRatio = record.principal / record.total_emi;
    const interestRatio = record.interest / record.total_emi;

    onSubmit({
      scheduleId: record.id,
      applicationId: record.loan_application_id,
      paymentDate,
      paymentAmount: amount,
      principalPaid: amount * principalRatio,
      interestPaid: amount * interestRatio,
      lateFeePaid: 0,
      paymentMethod,
      transactionReference: transactionRef || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setPaymentAmount("");
    setTransactionRef("");
    setNotes("");
    setPaymentMethod("upi");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!record) return null;

  const remaining = record.total_emi - record.amount_paid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Record Payment
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Application:</span>
                <span className="font-medium">{record.application_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Applicant:</span>
                <span className="font-medium">{record.applicant_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">EMI #{record.emi_number}:</span>
                <span className="font-medium">{formatCurrency(record.total_emi)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-medium text-green-600">{formatCurrency(record.amount_paid)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground font-medium">Remaining:</span>
                <span className="font-bold text-primary">{formatCurrency(remaining)}</span>
              </div>
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="nach">NACH</SelectItem>
                  <SelectItem value="neft">NEFT</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="imps">IMPS</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount Received</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder={remaining.toString()}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setPaymentAmount(remaining.toString())}
              >
                Fill full amount ({formatCurrency(remaining)})
              </Button>
            </div>

            {/* Transaction Reference */}
            <div className="space-y-2">
              <Label htmlFor="transactionRef">Transaction Reference</Label>
              <Input
                id="transactionRef"
                placeholder="UTR / Reference Number"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !paymentAmount}>
              {isSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
