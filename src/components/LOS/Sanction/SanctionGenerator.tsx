import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download } from "lucide-react";
import { format } from "date-fns";

interface SanctionGeneratorProps {
  applicationId: string;
  orgId: string;
}

export default function SanctionGenerator({ applicationId, orgId }: SanctionGeneratorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [interestRate, setInterestRate] = useState("");
  const [processingFee, setProcessingFee] = useState("");
  const [terms, setTerms] = useState("");

  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*, loan_applicants(*)")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: approval } = useQuery({
    queryKey: ["loan-approvals", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_approvals")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("approval_status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const { data: existingSanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const generateSanctionMutation = useMutation({
    mutationFn: async () => {
      if (!approval?.approved_amount) {
        throw new Error("No approved amount found");
      }

      const sanctionNumber = `SL${Date.now()}`;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30); // Valid for 30 days

      const { error } = await supabase.from("loan_sanctions").insert({
        loan_application_id: applicationId,
        sanction_number: sanctionNumber,
        sanction_date: new Date().toISOString(),
        sanctioned_amount: approval.approved_amount,
        sanctioned_rate: parseFloat(interestRate),
        sanctioned_tenure: application?.tenure_months || 0,
        processing_fee: parseFloat(processingFee),
        net_disbursement_amount: approval.approved_amount - parseFloat(processingFee),
        conditions: { terms: terms },
        validity_date: validUntil.toISOString(),
        status: "active",
      });

      if (error) throw error;

      // Update application stage
      await supabase
        .from("loan_applications")
        .update({
          current_stage: "disbursement_pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-sanction", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      toast({ title: "Sanction letter generated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (existingSanction) {
    return null; // Show viewer instead
  }

  if (!approval) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Application must be approved before generating sanction letter
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generate Sanction Letter
        </CardTitle>
        <CardDescription>
          Enter final sanction details to generate the letter
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="approved-amount">Approved Amount</Label>
            <Input
              id="approved-amount"
              value={`₹${approval.approved_amount?.toLocaleString("en-IN")}`}
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenure">Tenure (Months)</Label>
            <Input
              id="tenure"
              value={application?.tenure_months}
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest-rate">Interest Rate (% p.a.) *</Label>
            <Input
              id="interest-rate"
              type="number"
              step="0.01"
              placeholder="e.g., 10.5"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="processing-fee">Processing Fee (₹) *</Label>
            <Input
              id="processing-fee"
              type="number"
              placeholder="e.g., 5000"
              value={processingFee}
              onChange={(e) => setProcessingFee(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="terms">Terms & Conditions *</Label>
          <Textarea
            id="terms"
            placeholder="Enter terms and conditions for the loan..."
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={6}
          />
        </div>

        <Button
          onClick={() => generateSanctionMutation.mutate()}
          disabled={
            !interestRate ||
            !processingFee ||
            !terms ||
            generateSanctionMutation.isPending
          }
        >
          {generateSanctionMutation.isPending ? "Generating..." : "Generate Sanction Letter"}
        </Button>
      </CardContent>
    </Card>
  );
}
