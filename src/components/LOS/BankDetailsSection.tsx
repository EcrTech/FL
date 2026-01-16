import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Landmark, Edit2, Save, X, Upload, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BankDetailsSectionProps {
  applicationId: string;
  orgId: string;
  applicantId?: string;
}

interface BankDetails {
  bank_account_number: string;
  bank_ifsc_code: string;
  bank_name: string;
  bank_branch: string;
  bank_account_holder_name: string;
  bank_account_type: string;
  bank_verified: boolean;
  bank_verified_at: string | null;
}

export function BankDetailsSection({ applicationId, orgId, applicantId }: BankDetailsSectionProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<BankDetails>({
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_name: "",
    bank_branch: "",
    bank_account_holder_name: "",
    bank_account_type: "savings",
    bank_verified: false,
    bank_verified_at: null,
  });

  // Fetch applicant data with bank details
  const { data: applicant, isLoading } = useQuery({
    queryKey: ["applicant-bank-details", applicantId],
    queryFn: async () => {
      if (!applicantId) return null;
      const { data, error } = await supabase
        .from("loan_applicants")
        .select("bank_account_number, bank_ifsc_code, bank_name, bank_branch, bank_account_holder_name, bank_account_type, bank_verified, bank_verified_at")
        .eq("id", applicantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!applicantId,
  });

  // Fetch parsed bank statement data if available
  const { data: bankStatementDoc } = useQuery({
    queryKey: ["bank-statement-parsed", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("ocr_data")
        .eq("loan_application_id", applicationId)
        .eq("document_type", "bank_statement")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  // Populate form with existing data or parsed data
  useEffect(() => {
    if (applicant) {
      setFormData({
        bank_account_number: applicant.bank_account_number || "",
        bank_ifsc_code: applicant.bank_ifsc_code || "",
        bank_name: applicant.bank_name || "",
        bank_branch: applicant.bank_branch || "",
        bank_account_holder_name: applicant.bank_account_holder_name || "",
        bank_account_type: applicant.bank_account_type || "savings",
        bank_verified: applicant.bank_verified || false,
        bank_verified_at: applicant.bank_verified_at || null,
      });
    } else if (bankStatementDoc?.ocr_data) {
      const parsed = bankStatementDoc.ocr_data as Record<string, any>;
      setFormData(prev => ({
        ...prev,
        bank_account_number: parsed.account_number || prev.bank_account_number,
        bank_ifsc_code: parsed.ifsc_code || prev.bank_ifsc_code,
        bank_name: parsed.bank_name || prev.bank_name,
        bank_branch: parsed.branch_name || prev.bank_branch,
        bank_account_holder_name: parsed.account_holder_name || prev.bank_account_holder_name,
      }));
    }
  }, [applicant, bankStatementDoc]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<BankDetails>) => {
      if (!applicantId) throw new Error("No applicant record found");
      const { error } = await supabase
        .from("loan_applicants")
        .update(data)
        .eq("id", applicantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bank details saved successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId, orgId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save bank details");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (applicant) {
      setFormData({
        bank_account_number: applicant.bank_account_number || "",
        bank_ifsc_code: applicant.bank_ifsc_code || "",
        bank_name: applicant.bank_name || "",
        bank_branch: applicant.bank_branch || "",
        bank_account_holder_name: applicant.bank_account_holder_name || "",
        bank_account_type: applicant.bank_account_type || "savings",
        bank_verified: applicant.bank_verified || false,
        bank_verified_at: applicant.bank_verified_at || null,
      });
    }
    setIsEditing(false);
  };

  const hasBankDetails = formData.bank_account_number || formData.bank_ifsc_code || formData.bank_name;
  const hasParsedData = bankStatementDoc?.ocr_data && !applicant?.bank_account_number;

  if (!applicantId) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4" />
            Bank Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Create an applicant profile first to add bank details</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" />
              Bank Account Details
              {formData.bank_verified && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {hasParsedData
                ? "Bank details auto-filled from bank statement. Review and save."
                : "Enter or verify bank account details for disbursement"
              }
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-1" />
              {hasBankDetails ? "Edit" : "Add"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : isEditing ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Account Holder Name</Label>
              <Input
                value={formData.bank_account_holder_name}
                onChange={(e) => setFormData({ ...formData, bank_account_holder_name: e.target.value })}
                placeholder="Enter account holder name"
              />
            </div>
            <div>
              <Label className="text-xs">Account Number</Label>
              <Input
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                placeholder="Enter account number"
              />
            </div>
            <div>
              <Label className="text-xs">IFSC Code</Label>
              <Input
                value={formData.bank_ifsc_code}
                onChange={(e) => setFormData({ ...formData, bank_ifsc_code: e.target.value.toUpperCase() })}
                placeholder="e.g., HDFC0001234"
                maxLength={11}
              />
            </div>
            <div>
              <Label className="text-xs">Bank Name</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="Enter bank name"
              />
            </div>
            <div>
              <Label className="text-xs">Branch</Label>
              <Input
                value={formData.bank_branch}
                onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                placeholder="Enter branch name"
              />
            </div>
            <div>
              <Label className="text-xs">Account Type</Label>
              <Select
                value={formData.bank_account_type}
                onValueChange={(value) => setFormData({ ...formData, bank_account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : hasBankDetails ? (
          <div className="grid gap-x-4 gap-y-2 md:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">Account Holder</label>
              <p className="text-sm">{formData.bank_account_holder_name || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Account Number</label>
              <p className="text-sm font-mono">
                {formData.bank_account_number
                  ? `****${formData.bank_account_number.slice(-4)}`
                  : "N/A"
                }
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">IFSC Code</label>
              <p className="text-sm font-mono">{formData.bank_ifsc_code || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bank Name</label>
              <p className="text-sm">{formData.bank_name || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Branch</label>
              <p className="text-sm">{formData.bank_branch || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Account Type</label>
              <p className="text-sm capitalize">{formData.bank_account_type || "N/A"}</p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-2">
            No bank details available. Upload a bank statement or click "Add" to enter manually.
          </div>
        )}

        {/* Verification placeholder */}
        {hasBankDetails && !formData.bank_verified && !isEditing && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" disabled className="opacity-60">
              <CheckCircle className="h-4 w-4 mr-2" />
              Verify Bank Account (Coming Soon)
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Bank account verification via API will be enabled soon
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
