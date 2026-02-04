import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { ArrowLeft, ArrowRight, Loader2, ExternalLink, QrCode } from "lucide-react";
import BankSelector from "./BankSelector";
import { QRCodeSVG } from "qrcode.react";

interface CreateMandateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  loanApplicationId: string;
  contactId?: string;
  applicantName: string;
  applicantPhone: string;
  applicantEmail?: string;
  loanAmount: number;
  emiAmount: number;
  tenure: number;
  loanNo?: string;
}

type Step = "bank" | "account" | "mandate" | "confirm" | "success";

export default function CreateMandateDialog({
  open,
  onOpenChange,
  orgId,
  loanApplicationId,
  contactId,
  applicantName,
  applicantPhone,
  applicantEmail,
  loanAmount,
  emiAmount,
  tenure,
  loanNo: existingLoanNo,
}: CreateMandateDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("bank");
  const [registrationUrl, setRegistrationUrl] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  // Form state
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [selectedBankName, setSelectedBankName] = useState("");
  const [authType, setAuthType] = useState("");
  const [accountHolderName, setAccountHolderName] = useState(applicantName);
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankAccountNoConfirm, setBankAccountNoConfirm] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountType, setAccountType] = useState<"Savings" | "Current">("Savings");
  const [collectionAmount, setCollectionAmount] = useState(emiAmount);
  const [frequency, setFrequency] = useState<"MNTH" | "QURT" | "MIAN" | "YEAR">("MNTH");
  const [firstCollectionDate, setFirstCollectionDate] = useState(
    format(addMonths(new Date(), 1), "yyyy-MM-dd")
  );
  const [collectionUntilCancel, setCollectionUntilCancel] = useState(true);
  const [finalCollectionDate, setFinalCollectionDate] = useState("");
  const [loanNo, setLoanNo] = useState(existingLoanNo || `LOAN-${Date.now()}`);

  // Notification override fields (for testing or different account holder)
  const [notificationPhone, setNotificationPhone] = useState(applicantPhone);
  const [notificationEmail, setNotificationEmail] = useState(applicantEmail || "");

  // Determine environment based on config
  const [environment, setEnvironment] = useState<"uat" | "production">("uat");

  // Fetch active Nupay config
  const { data: config } = useQuery({
    queryKey: ["nupay-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nupay_config")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (data) setEnvironment(data.environment as "uat" | "production");
      return data;
    },
    enabled: !!orgId && open,
  });

  // Fetch banks
  const { data: banksData, isLoading: banksLoading } = useQuery({
    queryKey: ["nupay-banks", orgId, environment],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("nupay-get-banks", {
        body: { org_id: orgId, environment },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    enabled: !!orgId && !!config && open,
  });

  // Create mandate mutation
  const createMandateMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("nupay-create-mandate", {
        body: {
          org_id: orgId,
          environment,
          loan_application_id: loanApplicationId,
          contact_id: contactId,
          loan_no: loanNo,
          seq_type: "RCUR",
          frequency,
          category_id: 7,
          collection_amount: collectionAmount,
          debit_type: false,
          first_collection_date: firstCollectionDate,
          final_collection_date: collectionUntilCancel ? undefined : finalCollectionDate,
          collection_until_cancel: collectionUntilCancel,
          account_holder_name: accountHolderName,
          bank_account_no: bankAccountNo,
          bank_account_no_confirmation: bankAccountNoConfirm,
          ifsc_code: ifscCode || undefined,
          bank_id: selectedBankId,
          bank_name: selectedBankName,
          account_type: accountType,
          auth_type: authType,
          mobile_no: notificationPhone.replace(/\D/g, "").slice(-10),
          email: notificationEmail || undefined,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("eMandate registration initiated");
      queryClient.invalidateQueries({ queryKey: ["nupay-mandates"] });
      
      if (data.registration_url) {
        setRegistrationUrl(data.registration_url);
        setStep("success");
      } else {
        onOpenChange(false);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to create mandate", { description: error.message });
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep("bank");
      setSelectedBankId(null);
      setSelectedBankName("");
      setAuthType("");
      setAccountHolderName(applicantName);
      setBankAccountNo("");
      setBankAccountNoConfirm("");
      setIfscCode("");
      setAccountType("Savings");
      setCollectionAmount(emiAmount);
      setFrequency("MNTH");
      setFirstCollectionDate(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
      setCollectionUntilCancel(true);
      setFinalCollectionDate("");
      setNotificationPhone(applicantPhone);
      setNotificationEmail(applicantEmail || "");
      setRegistrationUrl(null);
      setShowQR(false);
    }
  }, [open, applicantName, emiAmount]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const canProceedFromBank = selectedBankId !== null && authType !== "";
  const isIfscValid = ifscCode === "" || ifscCode.length === 11;
  const canProceedFromAccount = 
    accountHolderName.trim() !== "" &&
    bankAccountNo.length >= 8 &&
    bankAccountNo === bankAccountNoConfirm &&
    isIfscValid;
  const canProceedFromMandate = 
    collectionAmount > 0 &&
    firstCollectionDate !== "" &&
    (collectionUntilCancel || finalCollectionDate !== "");

  const handleNext = () => {
    if (step === "bank" && canProceedFromBank) setStep("account");
    else if (step === "account" && canProceedFromAccount) setStep("mandate");
    else if (step === "mandate" && canProceedFromMandate) setStep("confirm");
    else if (step === "confirm") createMandateMutation.mutate();
  };

  const handleBack = () => {
    if (step === "account") setStep("bank");
    else if (step === "mandate") setStep("account");
    else if (step === "confirm") setStep("mandate");
  };

  if (!config) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>eMandate Setup Required</DialogTitle>
            <DialogDescription>
              Please configure Nupay eMandate settings before registering mandates.
              Go to Settings → eMandate to add your API credentials.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "success" ? "eMandate Submitted" : "Register eMandate"}
          </DialogTitle>
          <DialogDescription>
            {step !== "success" && (
              <>
                {loanNo} | EMI: {formatCurrency(emiAmount)}/month
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Bank Selection */}
        {step === "bank" && (
          <div className="space-y-4">
            <BankSelector
              banks={banksData?.banks || []}
              selectedBankId={selectedBankId}
              selectedAuthType={authType}
              onBankSelect={(bankId, bankName) => {
                setSelectedBankId(bankId);
                setSelectedBankName(bankName);
              }}
              onAuthTypeSelect={setAuthType}
              isLoading={banksLoading}
            />
          </div>
        )}

        {/* Step 2: Account Details */}
        {step === "account" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="accountHolder">Account Holder Name</Label>
              <Input
                id="accountHolder"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="As per bank records"
              />
            </div>
            <div>
              <Label htmlFor="accountNo">Bank Account Number</Label>
              <Input
                id="accountNo"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter account number"
              />
            </div>
            <div>
              <Label htmlFor="accountNoConfirm">Confirm Account Number</Label>
              <Input
                id="accountNoConfirm"
                value={bankAccountNoConfirm}
                onChange={(e) => setBankAccountNoConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="Re-enter account number"
              />
              {bankAccountNo && bankAccountNoConfirm && bankAccountNo !== bankAccountNoConfirm && (
                <p className="text-xs text-destructive mt-1">Account numbers don't match</p>
              )}
            </div>
            <div>
              <Label htmlFor="ifsc">IFSC Code (Optional)</Label>
              <Input
                id="ifsc"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="e.g., HDFC0001234"
                maxLength={11}
              />
              {ifscCode && ifscCode.length !== 11 && (
                <p className="text-xs text-destructive mt-1">IFSC code must be exactly 11 characters</p>
              )}
            </div>
            <div>
              <Label>Account Type</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as "Savings" | "Current")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Savings">Savings Account</SelectItem>
                  <SelectItem value="Current">Current Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <hr className="my-4" />
            <p className="text-sm font-medium text-muted-foreground">Notification Settings</p>
            <div>
              <Label htmlFor="notifPhone">Notification Mobile</Label>
              <Input
                id="notifPhone"
                value={notificationPhone}
                onChange={(e) => setNotificationPhone(e.target.value)}
                placeholder="10-digit mobile number"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Registration link will be sent to this number
              </p>
            </div>
            <div>
              <Label htmlFor="notifEmail">Notification Email (Optional)</Label>
              <Input
                id="notifEmail"
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>
        )}

        {/* Step 3: Mandate Details */}
        {step === "mandate" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Collection Amount</Label>
              <Input
                id="amount"
                type="number"
                value={collectionAmount}
                onChange={(e) => setCollectionAmount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum amount that can be debited per cycle
              </p>
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MNTH">Monthly</SelectItem>
                  <SelectItem value="QURT">Quarterly</SelectItem>
                  <SelectItem value="MIAN">Half-Yearly</SelectItem>
                  <SelectItem value="YEAR">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="firstDate">First Collection Date</Label>
              <Input
                id="firstDate"
                type="date"
                value={firstCollectionDate}
                onChange={(e) => setFirstCollectionDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="untilCancel"
                checked={collectionUntilCancel}
                onCheckedChange={(checked) => setCollectionUntilCancel(checked as boolean)}
              />
              <Label htmlFor="untilCancel" className="cursor-pointer">
                Continue until cancelled
              </Label>
            </div>
            {!collectionUntilCancel && (
              <div>
                <Label htmlFor="finalDate">Final Collection Date</Label>
                <Input
                  id="finalDate"
                  type="date"
                  value={finalCollectionDate}
                  onChange={(e) => setFinalCollectionDate(e.target.value)}
                  min={firstCollectionDate}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-medium">{selectedBankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium">
                  ****{bankAccountNo.slice(-4)} ({accountType})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Holder</span>
                <span className="font-medium">{accountHolderName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auth Type</span>
                <span className="font-medium">{authType}</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatCurrency(collectionAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frequency</span>
                <span className="font-medium">
                  {frequency === "MNTH" ? "Monthly" : frequency === "QURT" ? "Quarterly" : frequency === "MIAN" ? "Half-Yearly" : "Yearly"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First Debit</span>
                <span className="font-medium">{format(new Date(firstCollectionDate), "dd MMM yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">
                  {collectionUntilCancel ? "Until Cancelled" : `Until ${format(new Date(finalCollectionDate), "dd MMM yyyy")}`}
                </span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notify Mobile</span>
                <span className="font-medium">{notificationPhone}</span>
              </div>
              {notificationEmail && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notify Email</span>
                  <span className="font-medium">{notificationEmail}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              By proceeding, you confirm that the customer has authorized this eMandate registration.
              The customer will receive a link to complete authentication.
            </p>
          </div>
        )}

        {/* Step 5: Success */}
        {step === "success" && registrationUrl && (
          <div className="space-y-4 text-center">
            <div className="bg-green-50 text-green-800 p-4 rounded-lg">
              <p className="font-medium">eMandate registration link generated!</p>
              <p className="text-sm mt-1">Share this link with the customer to complete authentication.</p>
            </div>

            {showQR ? (
              <div className="flex flex-col items-center gap-4">
                <QRCodeSVG value={registrationUrl} size={200} />
                <Button variant="outline" onClick={() => setShowQR(false)}>
                  Hide QR Code
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowQR(true)}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Show QR
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(registrationUrl);
                    toast.success("Link copied to clipboard");
                  }}
                >
                  Copy Link
                </Button>
                <Button asChild>
                  <a href={registrationUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Link
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          {step === "success" ? (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={step === "bank" ? () => onOpenChange(false) : handleBack}
              >
                {step === "bank" ? "Cancel" : (
                  <>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </>
                )}
              </Button>
              <Button
                onClick={handleNext}
                disabled={
                  (step === "bank" && !canProceedFromBank) ||
                  (step === "account" && !canProceedFromAccount) ||
                  (step === "mandate" && !canProceedFromMandate) ||
                  createMandateMutation.isPending
                }
              >
                {createMandateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : step === "confirm" ? (
                  "Submit eMandate"
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
