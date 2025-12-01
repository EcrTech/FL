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
import { Loader2 } from "lucide-react";

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
    aadhaar_number: "",
    aadhaar_last4: existingVerification?.request_data?.aadhaar_last4 || "",
    verified_address: existingVerification?.response_data?.verified_address || "",
    address_match_result: existingVerification?.response_data?.address_match_result || "exact",
    aadhaar_status: existingVerification?.response_data?.aadhaar_status || "valid",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
  });

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");

  // Authenticate with Sandbox
  const authMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sandbox-authenticate');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      toast({ title: "Authenticated successfully" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error.message || "Failed to authenticate with verification service",
      });
    },
  });

  // Generate OTP
  const generateOtpMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Not authenticated. Please authenticate first.");
      }
      if (!formData.aadhaar_number || formData.aadhaar_number.length !== 12) {
        throw new Error("Please enter a valid 12-digit Aadhaar number");
      }

      const { data, error } = await supabase.functions.invoke('sandbox-aadhaar-okyc', {
        body: {
          operation: 'generate-otp',
          aadhaarNumber: formData.aadhaar_number,
          orgId,
          accessToken,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setOtpRequestId(data.request_id);
      toast({
        title: "OTP Sent",
        description: data.message || "OTP sent to registered mobile number",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send OTP",
        description: error.message || "Could not generate OTP",
      });
    },
  });

  // Verify OTP
  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !otpRequestId) {
        throw new Error("OTP not generated. Please generate OTP first.");
      }
      if (!otpValue) {
        throw new Error("Please enter the OTP");
      }

      const { data, error } = await supabase.functions.invoke('sandbox-aadhaar-okyc', {
        body: {
          operation: 'verify-otp',
          otp: otpValue,
          requestId: otpRequestId,
          applicationId,
          orgId,
          accessToken,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Aadhaar Verified",
        description: "Aadhaar details verified successfully",
      });
      // Update form with verified data
      setFormData(prev => ({
        ...prev,
        aadhaar_last4: prev.aadhaar_number.slice(-4),
        verified_address: data.data.address?.combined || prev.verified_address,
        status: data.verification_status,
      }));
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
      setOtpValue("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Failed to verify Aadhaar",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "aadhaar",
        verification_source: "uidai",
        status: formData.status,
        request_data: { aadhaar_last4: formData.aadhaar_last4 },
        response_data: {
          verified_address: formData.verified_address,
          address_match_result: formData.address_match_result,
          aadhaar_status: formData.aadhaar_status,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aadhaar Verification</DialogTitle>
          <DialogDescription>
            Manual entry for Aadhaar verification results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Authentication and API Verification Actions */}
          <div className="space-y-2">
            {!accessToken ? (
              <Button
                onClick={() => authMutation.mutate()}
                disabled={authMutation.isPending}
                variant="outline"
                className="w-full"
              >
                {authMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Authenticate with Sandbox
              </Button>
            ) : (
              <>
                <div>
                  <Label>Full Aadhaar Number (12 digits)</Label>
                  <Input
                    value={formData.aadhaar_number}
                    onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                    placeholder="Enter 12-digit Aadhaar"
                    maxLength={12}
                  />
                </div>
                
                {!otpRequestId ? (
                  <Button
                    onClick={() => generateOtpMutation.mutate()}
                    disabled={!formData.aadhaar_number || generateOtpMutation.isPending}
                    variant="default"
                    className="w-full"
                  >
                    {generateOtpMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send OTP
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Label>Enter OTP</Label>
                    <Input
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => verifyOtpMutation.mutate()}
                        disabled={!otpValue || verifyOtpMutation.isPending}
                        className="flex-1"
                      >
                        {verifyOtpMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verify OTP
                      </Button>
                      <Button
                        onClick={() => {
                          setOtpRequestId(null);
                          setOtpValue("");
                        }}
                        variant="outline"
                      >
                        Resend OTP
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Manual Entry (Optional)</h4>
          </div>

          <div>
            <Label>Aadhaar Last 4 Digits</Label>
            <Input
              value={formData.aadhaar_last4}
              onChange={(e) => setFormData({ ...formData, aadhaar_last4: e.target.value })}
              placeholder="XXXX"
              maxLength={4}
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
