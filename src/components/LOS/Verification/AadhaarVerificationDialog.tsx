import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AadhaarVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function AadhaarVerificationDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: AadhaarVerificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    aadhaar_last4: existingVerification?.request_data?.aadhaar_last4 || "",
    verified_address: existingVerification?.response_data?.verified_address || "",
    address_match_result: existingVerification?.response_data?.address_match_result || "exact",
    aadhaar_status: existingVerification?.response_data?.aadhaar_status || "valid",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
    name: existingVerification?.response_data?.name || "",
  });

  const [digilockerUrl, setDigilockerUrl] = useState<string | null>(null);

  // Get the base URL for callbacks
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  // Initiate Aadhaar verification via VerifiedU DigiLocker
  const initiateMutation = useMutation({
    mutationFn: async () => {
      const baseUrl = getBaseUrl();
      
      const { data, error } = await supabase.functions.invoke('verifiedu-aadhaar-initiate', {
        body: {
          applicationId,
          orgId,
          successUrl: `${baseUrl}/digilocker/success`,
          failureUrl: `${baseUrl}/digilocker/failure`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to initiate Aadhaar verification");
      return data;
    },
    onSuccess: (data) => {
      if (data.is_mock) {
        toast({
          title: "Mock Mode",
          description: "VerifiedU credentials not configured. Redirecting to mock success page.",
        });
        // In mock mode, redirect directly to success page
        window.location.href = data.data.url;
      } else {
        setDigilockerUrl(data.data.url);
        toast({
          title: "DigiLocker Ready",
          description: "Click the button to open DigiLocker and verify your Aadhaar",
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Initiation Failed",
        description: error.message || "Failed to initiate Aadhaar verification",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "aadhaar",
        verification_source: "verifiedu",
        status: formData.status,
        request_data: { aadhaar_last4: formData.aadhaar_last4 },
        response_data: {
          verified_address: formData.verified_address,
          address_match_result: formData.address_match_result,
          aadhaar_status: formData.aadhaar_status,
          name: formData.name,
        },
        remarks: formData.remarks,
        verified_at: new Date().toISOString(),
      };

      if (existingVerification) {
        const { error } = await supabase
          .from("loan_verifications")
          .update(verificationData)
          .eq("id", existingVerification.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loan_verifications")
          .insert(verificationData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
      toast({ title: "Aadhaar verification saved successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save verification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openDigilocker = () => {
    if (digilockerUrl) {
      window.open(digilockerUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aadhaar Verification</DialogTitle>
          <DialogDescription>
            Verify Aadhaar via VerifiedU DigiLocker integration
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* DigiLocker Verification Flow */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aadhaar verification uses DigiLocker. The applicant will be redirected to DigiLocker to authorize access to their Aadhaar data.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {!digilockerUrl ? (
              <Button
                onClick={() => initiateMutation.mutate()}
                disabled={initiateMutation.isPending}
                variant="default"
                className="w-full"
              >
                {initiateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initiate DigiLocker Verification
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">DigiLocker verification initiated</span>
                </div>
                <Button
                  onClick={openDigilocker}
                  variant="default"
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open DigiLocker to Complete Verification
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  After completing verification in DigiLocker, the data will be automatically fetched.
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Manual Entry (Optional)</h4>
          </div>

          <div>
            <Label>Aadhaar Last 4 Digits</Label>
            <Input
              value={formData.aadhaar_last4}
              onChange={(e) => setFormData({ ...formData, aadhaar_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="XXXX"
              maxLength={4}
            />
          </div>

          <div>
            <Label>Name on Aadhaar</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full name as per Aadhaar"
            />
          </div>

          <div>
            <Label>Verified Address</Label>
            <Textarea
              value={formData.verified_address}
              onChange={(e) => setFormData({ ...formData, verified_address: e.target.value })}
              placeholder="Address as per Aadhaar"
              rows={3}
            />
          </div>

          <div>
            <Label>Address Match Result</Label>
            <Select value={formData.address_match_result} onValueChange={(value) => setFormData({ ...formData, address_match_result: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact Match</SelectItem>
                <SelectItem value="partial">Partial Match</SelectItem>
                <SelectItem value="no_match">No Match</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Aadhaar Status</Label>
            <Select value={formData.aadhaar_status} onValueChange={(value) => setFormData({ ...formData, aadhaar_status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
                <SelectItem value="not_found">Not Found</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Verification Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Additional notes or observations"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
