import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NACHDebitRequest {
  org_id: string;
  environment: "uat" | "production";
  mandate_id: string;
  amount: number;
  emi_schedule_id?: string;
  remarks?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { org_id, environment, mandate_id, amount, emi_schedule_id, remarks }: NACHDebitRequest = await req.json();

    if (!org_id || !environment || !mandate_id || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the mandate
    const { data: mandate, error: mandateError } = await supabase
      .from("rbl_nach_mandates")
      .select("*")
      .eq("id", mandate_id)
      .eq("org_id", org_id)
      .single();

    if (mandateError || !mandate) {
      return new Response(
        JSON.stringify({ error: "Mandate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mandate.status !== "active") {
      return new Response(
        JSON.stringify({ error: `Mandate is not active. Current status: ${mandate.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amount > mandate.max_amount) {
      return new Response(
        JSON.stringify({ error: `Amount exceeds mandate limit of ₹${mandate.max_amount}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch RBL config
    const { data: config, error: configError } = await supabase
      .from("rbl_bank_config")
      .select("*")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "RBL Bank configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate reference ID
    const referenceId = `DEBIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log the transaction
    const { data: transaction, error: txError } = await supabase
      .from("rbl_payment_transactions")
      .insert({
        org_id,
        loan_application_id: mandate.loan_application_id,
        transaction_type: "mandate_debit",
        payment_mode: "NACH",
        amount,
        status: "processing",
        reference_id: referenceId,
        beneficiary_name: mandate.account_holder_name,
        beneficiary_account: mandate.account_number,
        beneficiary_ifsc: mandate.ifsc_code,
        request_payload: { mandate_id, amount, emi_schedule_id, remarks },
        initiated_by: user.id,
      })
      .select()
      .single();

    if (txError) {
      console.error("[RBL-NACH-Debit] Failed to log transaction:", txError);
    }

    // Call RBL NACH Debit API
    const debitEndpoint = `${config.api_endpoint}/v1/nach/debit`;

    console.log(`[RBL-NACH-Debit] Initiating debit at ${debitEndpoint}`);

    const apiPayload = {
      reference_id: referenceId,
      umrn: mandate.umrn,
      amount: amount,
      debit_date: new Date().toISOString().split("T")[0],
      remarks: remarks || `EMI Collection - ${mandate.loan_application_id}`,
    };

    // Simulate API response
    const simulatedResponse = {
      success: true,
      reference_id: referenceId,
      status: "SCHEDULED",
      scheduled_date: new Date().toISOString().split("T")[0],
      message: "NACH debit scheduled successfully",
    };

    // Update transaction with response
    if (transaction) {
      await supabase
        .from("rbl_payment_transactions")
        .update({
          response_payload: simulatedResponse,
        })
        .eq("id", transaction.id);
    }

    // If EMI schedule ID provided, update that record
    if (emi_schedule_id) {
      await supabase
        .from("loan_repayment_schedule")
        .update({
          nach_debit_reference: referenceId,
          nach_debit_status: "scheduled",
        })
        .eq("id", emi_schedule_id);
    }

    console.log(`[RBL-NACH-Debit] Debit scheduled: ${referenceId}`);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction?.id,
        reference_id: referenceId,
        status: "SCHEDULED",
        scheduled_date: simulatedResponse.scheduled_date,
        message: simulatedResponse.message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RBL-NACH-Debit] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
