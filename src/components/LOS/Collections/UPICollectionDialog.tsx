import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { 
  Loader2, 
  Copy, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  MessageSquare,
  ExternalLink
} from "lucide-react";
import { CollectionRecord } from "@/hooks/useCollections";
import { useUPICollection, UPITransaction } from "@/hooks/useUPICollection";

interface UPICollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CollectionRecord | null;
}

export function UPICollectionDialog({
  open,
  onOpenChange,
  record,
}: UPICollectionDialogProps) {
  const [transaction, setTransaction] = useState<UPITransaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { 
    createCollection, 
    isCreating, 
    checkStatus, 
    isCheckingStatus,
    getExistingTransaction,
    isCollectionEnabled 
  } = useUPICollection();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Check for existing transaction when dialog opens
  useEffect(() => {
    if (open && record?.id) {
      setIsLoading(true);
      getExistingTransaction(record.id)
        .then((existing) => {
          if (existing) {
            setTransaction(existing);
          } else {
            setTransaction(null);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setTransaction(null);
    }
  }, [open, record?.id]);

  const handleGeneratePaymentLink = async () => {
    if (!record) return;

    try {
      const result = await createCollection({
        schedule_id: record.id,
        loan_application_id: record.loan_application_id,
        loan_id: record.loan_id || undefined,
        emi_number: 1,
        amount: record.total_emi - record.amount_paid,
        payer_name: record.applicant_name,
        payer_mobile: record.applicant_phone,
      });

      setTransaction(result);
    } catch (error) {
      console.error("Failed to generate payment link:", error);
    }
  };

  const handleRefreshStatus = async () => {
    if (!transaction?.client_reference_id) return;

    try {
      const updated = await checkStatus(transaction.client_reference_id);
      if (updated) {
        setTransaction(updated);
      }
    } catch (error) {
      console.error("Failed to refresh status:", error);
    }
  };

  const handleCopyLink = () => {
    if (transaction?.payment_link) {
      navigator.clipboard.writeText(transaction.payment_link);
      toast.success("Payment link copied to clipboard");
    }
  };

  const handleShareWhatsApp = () => {
    if (!transaction?.payment_link || !record) return;

    const message = `Dear ${record.applicant_name},\n\nPlease pay your due amount of ${formatCurrency(record.total_emi - record.amount_paid)} using this link:\n\n${transaction.payment_link}\n\nThis link expires in 30 minutes.`;
    
    const whatsappUrl = `https://wa.me/${record.applicant_phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <Badge className="bg-green-100 text-green-800 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Paid
          </Badge>
        );
      case "FAILED":
      case "REJECTED":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {status}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const balanceAmount = record ? record.total_emi - record.amount_paid : 0;

  if (!isCollectionEnabled) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>UPI Collection Not Configured</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            <p>UPI Collection (Collection 360) is not configured.</p>
            <p className="mt-2 text-sm">
              Please configure your Nupay Collection 360 credentials in Settings → Nupay Integration.
            </p>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Collect EMI via UPI</DialogTitle>
        </DialogHeader>

        {record && (
          <div className="space-y-4">
            {/* EMI Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Application</span>
                <span className="font-medium">{record.application_number}</span>
              </div>
              {record.loan_id && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Loan ID</span>
                  <span className="font-medium">{record.loan_id}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Amount</span>
                <span className="font-medium">{formatCurrency(record.total_emi)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">{formatDate(record.due_date)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount to Collect</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(balanceAmount)}
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !transaction ? (
              /* Generate Payment Link Button */
              <Button
                className="w-full"
                onClick={handleGeneratePaymentLink}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Payment Link"
                )}
              </Button>
            ) : (
              /* Payment Link Generated */
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(transaction.status)}
                </div>

                {transaction.status === "pending" && (
                  <>
                    {/* QR Code */}
                    {transaction.payee_vpa && (
                      <div className="flex justify-center p-4 bg-white rounded-lg">
                        <QRCodeSVG
                          value={`upi://pay?pa=${transaction.payee_vpa}&pn=EMI Payment&am=${balanceAmount}&cu=INR`}
                          size={180}
                          level="M"
                          includeMargin
                        />
                      </div>
                    )}

                    {/* Payment Link */}
                    {transaction.payment_link && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Payment Link</Label>
                        <div className="flex gap-2">
                          <Input
                            value={transaction.payment_link}
                            readOnly
                            className="text-xs"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={handleCopyLink}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Payee VPA */}
                    {transaction.payee_vpa && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">UPI ID</Label>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
                            {transaction.payee_vpa}
                          </code>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(transaction.payee_vpa || "");
                              toast.success("UPI ID copied");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Expiry Info */}
                    {transaction.expires_at && (
                      <p className="text-xs text-muted-foreground text-center">
                        Link expires at {new Date(transaction.expires_at).toLocaleTimeString("en-IN")}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={handleShareWhatsApp}
                        className="gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleRefreshStatus}
                        disabled={isCheckingStatus}
                        className="gap-2"
                      >
                        {isCheckingStatus ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Refresh
                      </Button>
                    </div>
                  </>
                )}

                {transaction.status === "SUCCESS" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Payment Received</span>
                    </div>
                    {transaction.utr && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">UTR: </span>
                        <span className="font-mono">{transaction.utr}</span>
                      </div>
                    )}
                    {transaction.payer_vpa && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">From: </span>
                        <span>{transaction.payer_vpa}</span>
                      </div>
                    )}
                    {transaction.transaction_amount && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Amount: </span>
                        <span className="font-medium">
                          {formatCurrency(transaction.transaction_amount)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {(transaction.status === "FAILED" || transaction.status === "REJECTED") && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-700">
                      <XCircle className="h-5 w-5" />
                      <span className="font-medium">Payment {transaction.status}</span>
                    </div>
                    {transaction.status_description && (
                      <p className="text-sm text-red-600 mt-1">
                        {transaction.status_description}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setTransaction(null)}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
