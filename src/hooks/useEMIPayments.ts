import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";
import { useToast } from "./use-toast";

export interface EMIPayment {
  id: string;
  loan_application_id: string;
  schedule_id?: string;
  org_id: string;
  payment_number: string;
  payment_date: string;
  payment_amount: number;
  principal_paid: number;
  interest_paid: number;
  late_fee_paid: number;
  payment_method: string;
  transaction_reference?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export function useEMIPayments(applicationId?: string) {
  const { orgId } = useOrgContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["emi-payments", applicationId, orgId],
    queryFn: async () => {
      if (!applicationId) return [];
      
      const { data, error } = await supabase
        .from("loan_payments")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("org_id", orgId)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data as EMIPayment[];
    },
    enabled: !!applicationId && !!orgId,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (payment: {
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
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const paymentNumber = `PMT${Date.now()}`;

      // Insert payment record
      const { error: paymentError } = await supabase
        .from("loan_payments")
        .insert({
          loan_application_id: payment.applicationId,
          schedule_id: payment.scheduleId,
          org_id: orgId!,
          payment_number: paymentNumber,
          payment_date: payment.paymentDate,
          payment_amount: payment.paymentAmount,
          principal_paid: payment.principalPaid,
          interest_paid: payment.interestPaid,
          late_fee_paid: payment.lateFeePaid,
          payment_method: payment.paymentMethod,
          transaction_reference: payment.transactionReference,
          notes: payment.notes,
          created_by: user?.user?.id,
        });

      if (paymentError) throw paymentError;

      // Update schedule status
      const { data: scheduleItem } = await supabase
        .from("loan_repayment_schedule")
        .select("total_emi, amount_paid")
        .eq("id", payment.scheduleId)
        .single();

      if (scheduleItem) {
        const newAmountPaid = (scheduleItem.amount_paid || 0) + payment.paymentAmount;
        const newStatus =
          newAmountPaid >= scheduleItem.total_emi
            ? "paid"
            : newAmountPaid > 0
            ? "partially_paid"
            : "pending";

        const updateData: any = {
          amount_paid: newAmountPaid,
          status: newStatus,
        };

        if (newStatus === "paid") {
          updateData.payment_date = payment.paymentDate;
        }

        const { error: updateError } = await supabase
          .from("loan_repayment_schedule")
          .update(updateData)
          .eq("id", payment.scheduleId);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emi-payments"] });
      queryClient.invalidateQueries({ queryKey: ["emi-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["emi-stats"] });
      toast({ title: "Payment recorded successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error recording payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    payments,
    isLoading,
    recordPayment: recordPaymentMutation.mutate,
    isRecording: recordPaymentMutation.isPending,
  };
}
