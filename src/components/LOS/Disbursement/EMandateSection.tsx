import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import CreateMandateDialog from "../Mandate/CreateMandateDialog";
import MandateStatusBadge from "../Mandate/MandateStatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface EMandateSectionProps {
  applicationId: string;
  orgId: string;
  borrowerName: string;
  borrowerPhone: string;
  borrowerEmail?: string;
  dailyEMI: number;
  loanAmount: number;
  tenureDays: number;
  loanNo: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function EMandateSection({
  applicationId,
  orgId,
  borrowerName,
  borrowerPhone,
  borrowerEmail,
  dailyEMI,
  loanAmount,
  tenureDays,
  loanNo,
}: EMandateSectionProps) {
  const [mandateDialogOpen, setMandateDialogOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [showReinitiateConfirm, setShowReinitiateConfirm] = useState(false);

  // Fetch active Nupay config for environment
  const { data: nupayConfig } = useQuery({
    queryKey: ["nupay-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nupay_config")
        .select("environment")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") {
        console.error("Error fetching Nupay config:", error);
      }
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch existing mandate for this application
  const { data: mandateData, isLoading: loadingMandate, refetch: refetchMandate } = useQuery({
    queryKey: ["nupay-mandates", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nupay_mandates")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") {
        console.error("Error fetching mandate:", error);
      }
      return data;
    },
    enabled: !!applicationId,
  });

  const handleCheckStatus = async () => {
    if (!mandateData?.nupay_id) {
      toast.error("No mandate ID to check");
      return;
    }

    setIsCheckingStatus(true);
    try {
      const response = await supabase.functions.invoke("nupay-get-status", {
        body: {
          org_id: orgId,
          environment: nupayConfig?.environment || "uat",
          mandate_id: mandateData.id,
          nupay_id: mandateData.nupay_id,
        },
      });

      if (response.error) throw response.error;
      
      toast.success("Status updated");
      refetchMandate();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to check status", { description: errorMessage });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const getMandateStatus = (): "pending" | "submitted" | "accepted" | "rejected" | "expired" | "cancelled" => {
    if (!mandateData) return "pending";
    const status = mandateData.status?.toLowerCase();
    if (status === "active" || status === "accepted") return "accepted";
    if (status === "rejected" || status === "failed") return "rejected";
    if (status === "expired") return "expired";
    if (status === "cancelled") return "cancelled";
    if (status === "submitted" || status === "registered") return "submitted";
    return "pending";
  };

  if (loadingMandate) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>eMandate Registration</CardTitle>
                <CardDescription>Set up automated loan repayment collection</CardDescription>
              </div>
            </div>
            {mandateData && (
              <MandateStatusBadge 
                status={getMandateStatus()}
                rejectionReasonCode={mandateData.rejection_reason_code}
                rejectionReasonDesc={mandateData.rejection_reason_desc}
                rejectedBy={mandateData.rejected_by}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!mandateData ? (
            // No mandate registered - show register button
            <div className="text-center py-6 space-y-4">
              <p className="text-muted-foreground">
                No eMandate registered for this loan. Register now to enable automated EMI collection.
              </p>
              <Button onClick={() => setMandateDialogOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Register eMandate
              </Button>
            </div>
          ) : (
            // Mandate exists - show details
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Mandate ID</p>
                  <p className="font-medium text-sm truncate" title={mandateData.nupay_id || mandateData.id}>
                    {mandateData.nupay_id || mandateData.id.slice(0, 8)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Bank</p>
                  <p className="font-medium text-sm truncate">{mandateData.bank_name || "N/A"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Account</p>
                  <p className="font-medium text-sm">
                    ****{mandateData.bank_account_no?.slice(-4) || "****"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-medium text-sm">
                    {formatCurrency(mandateData.collection_amount || dailyEMI)} / 
                    {mandateData.frequency === "MNTH" ? "month" : 
                     mandateData.frequency === "DAIL" ? "day" : 
                     mandateData.frequency || "month"}
                  </p>
                </div>
              </div>

              {/* Registration URL / QR for pending/submitted status */}
              {mandateData.registration_url && getMandateStatus() !== "accepted" && (
                <div className="border rounded-lg p-4 bg-blue-50/50 space-y-3">
                  <p className="text-sm text-blue-800 font-medium">
                    Customer authentication required
                  </p>
                  <p className="text-xs text-blue-600">
                    Share the registration link with the customer to complete eMandate authentication.
                  </p>
                  
                  {showQR ? (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <QRCodeSVG value={mandateData.registration_url} size={150} />
                      <Button variant="ghost" size="sm" onClick={() => setShowQR(false)}>
                        Hide QR Code
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowQR(true)}
                      >
                        Show QR Code
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(mandateData.registration_url);
                          toast.success("Link copied to clipboard");
                        }}
                      >
                        Copy Link
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(mandateData.registration_url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open Link
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                >
                  {isCheckingStatus ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Check Status
                </Button>
                
                {/* Show reinitiate for any non-accepted status when mandate exists */}
                {getMandateStatus() !== "accepted" && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Show confirmation for submitted/pending (link will be invalidated)
                      if (getMandateStatus() === "submitted" || getMandateStatus() === "pending") {
                        setShowReinitiateConfirm(true);
                      } else {
                        setMandateDialogOpen(true);
                      }
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Reinitiate NACH
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Mandate Dialog */}
      <CreateMandateDialog
        open={mandateDialogOpen}
        onOpenChange={(open) => {
          setMandateDialogOpen(open);
          if (!open) refetchMandate();
        }}
        orgId={orgId}
        loanApplicationId={applicationId}
        applicantName={borrowerName}
        applicantPhone={borrowerPhone}
        applicantEmail={borrowerEmail}
        loanAmount={loanAmount}
        emiAmount={dailyEMI}
        tenure={tenureDays}
        loanNo={loanNo}
        prefillData={mandateData ? {
          bankName: mandateData.bank_name,
          bankAccountNo: mandateData.bank_account_no,
          ifsc: mandateData.ifsc_code,
          accountType: mandateData.account_type,
          accountHolderName: mandateData.account_holder_name,
        } : undefined}
      />

      {/* Reinitiate Confirmation Dialog */}
      <ConfirmDialog
        open={showReinitiateConfirm}
        onOpenChange={setShowReinitiateConfirm}
        title="Reinitiate eMandate?"
        description="The previous registration link will become invalid. The customer will need to complete authentication again with the new link."
        onConfirm={() => {
          setShowReinitiateConfirm(false);
          setMandateDialogOpen(true);
        }}
        confirmText="Reinitiate"
        variant="default"
      />
    </>
  );
}
