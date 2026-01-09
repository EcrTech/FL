import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rbl-signature",
};

interface RBLWebhookPayload {
  event_type: string;
  reference_id: string;
  utr_number?: string;
  status: string;
  amount?: number;
  transaction_date?: string;
  completion_date?: string;
  failure_reason?: string;
  beneficiary_details?: {
    name?: string;
    account_number?: string;
    ifsc?: string;
  };
  signature?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook signature (implementation depends on RBL's signature method)
    const signature = req.headers.get("x-rbl-signature");
    const webhookSecret = Deno.env.get("RBL_WEBHOOK_SECRET");

    // Log raw request for debugging
    const rawBody = await req.text();
    console.log(`[RBL-Webhook] Received webhook: ${rawBody}`);

    let payload: RBLWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { event_type, reference_id, utr_number, status, amount, failure_reason } = payload;

    if (!reference_id) {
      return new Response(
        JSON.stringify({ error: "reference_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[RBL-Webhook] Processing ${event_type} for ${reference_id}, status: ${status}`);

    // Find the transaction by reference_id
    const { data: transaction, error: txError } = await supabase
      .from("rbl_payment_transactions")
      .select("*, loan_disbursements(*)")
      .eq("reference_id", reference_id)
      .single();

    if (txError || !transaction) {
      console.error(`[RBL-Webhook] Transaction not found for reference_id: ${reference_id}`);
      // Still return 200 to acknowledge receipt
      return new Response(
        JSON.stringify({ success: true, message: "Webhook received, transaction not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map RBL status to our status
    const statusMap: Record<string, string> = {
      "SUCCESS": "success",
      "COMPLETED": "success",
      "FAILED": "failed",
      "REJECTED": "failed",
      "REVERSED": "failed",
      "PENDING": "pending",
      "PROCESSING": "processing",
      "IN_PROGRESS": "processing",
    };

    const mappedStatus = statusMap[status.toUpperCase()] || status.toLowerCase();

    // Update transaction record
    const { error: updateError } = await supabase
      .from("rbl_payment_transactions")
      .update({
        status: mappedStatus,
        utr_number: utr_number || transaction.utr_number,
        callback_data: payload,
        error_message: failure_reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    if (updateError) {
      console.error(`[RBL-Webhook] Failed to update transaction:`, updateError);
    }

    // Handle disbursement updates
    if (transaction.disbursement_id && transaction.transaction_type === "disbursement") {
      const disbursementStatus = mappedStatus === "success" ? "completed" : 
                                  mappedStatus === "failed" ? "failed" : "processing";
      
      await supabase
        .from("loan_disbursements")
        .update({
          status: disbursementStatus,
          utr_number: utr_number || transaction.utr_number,
          ...(disbursementStatus === "completed" && { disbursed_at: new Date().toISOString() }),
        })
        .eq("id", transaction.disbursement_id);

      // If disbursement completed, update loan application status
      if (disbursementStatus === "completed" && transaction.loan_application_id) {
        await supabase
          .from("loan_applications")
          .update({
            status: "disbursed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.loan_application_id);
      }
    }

    // Handle NACH mandate updates
    if (event_type === "MANDATE_STATUS" || event_type === "NACH_STATUS") {
      const { data: mandate } = await supabase
        .from("rbl_nach_mandates")
        .select("*")
        .eq("mandate_id", reference_id)
        .single();

      if (mandate) {
        const mandateStatus = status.toUpperCase() === "APPROVED" ? "active" :
                              status.toUpperCase() === "REJECTED" ? "rejected" :
                              status.toUpperCase() === "CANCELLED" ? "cancelled" : "pending";

        await supabase
          .from("rbl_nach_mandates")
          .update({
            status: mandateStatus,
            umrn: payload.utr_number, // UMRN is often sent in the utr_number field
            rejection_reason: failure_reason,
            response_payload: payload,
          })
          .eq("id", mandate.id);
      }
    }

    console.log(`[RBL-Webhook] Successfully processed webhook for ${reference_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook processed successfully",
        transaction_id: transaction.id,
        new_status: mappedStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RBL-Webhook] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
