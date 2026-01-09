import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FundTransferRequest {
  org_id: string;
  environment: "uat" | "production";
  loan_application_id: string;
  disbursement_id: string;
  amount: number;
  payment_mode: "NEFT" | "RTGS" | "IMPS";
  beneficiary_name: string;
  beneficiary_account: string;
  beneficiary_ifsc: string;
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

    const requestData: FundTransferRequest = await req.json();
    const {
      org_id,
      environment,
      loan_application_id,
      disbursement_id,
      amount,
      payment_mode,
      beneficiary_name,
      beneficiary_account,
      beneficiary_ifsc,
      remarks,
    } = requestData;

    // Validate required fields
    if (!org_id || !environment || !loan_application_id || !amount || !payment_mode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate payment mode based on amount for RTGS
    if (payment_mode === "RTGS" && amount < 200000) {
      return new Response(
        JSON.stringify({ error: "RTGS is only available for amounts >= ₹2,00,000" }),
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
        JSON.stringify({ error: "RBL Bank configuration not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique reference ID
    const referenceId = `DISB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log the transaction
    const { data: transaction, error: txError } = await supabase
      .from("rbl_payment_transactions")
      .insert({
        org_id,
        loan_application_id,
        disbursement_id,
        transaction_type: "disbursement",
        payment_mode,
        amount,
        status: "processing",
        reference_id: referenceId,
        beneficiary_name,
        beneficiary_account,
        beneficiary_ifsc,
        request_payload: requestData,
        initiated_by: user.id,
      })
      .select()
      .single();

    if (txError) {
      console.error("[RBL-FundTransfer] Failed to log transaction:", txError);
      return new Response(
        JSON.stringify({ error: "Failed to create transaction record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call RBL Fund Transfer API
    // Note: Actual endpoint will be provided by RBL
    const transferEndpoint = `${config.api_endpoint}/v1/payments/${payment_mode.toLowerCase()}`;

    console.log(`[RBL-FundTransfer] Initiating ${payment_mode} transfer at ${transferEndpoint}`);

    const apiPayload = {
      reference_id: referenceId,
      amount: amount,
      beneficiary_account_number: beneficiary_account,
      beneficiary_ifsc: beneficiary_ifsc,
      beneficiary_name: beneficiary_name,
      payment_mode: payment_mode,
      remarks: remarks || `Loan Disbursement - ${loan_application_id}`,
    };

    // Simulate API response (replace with actual API call when credentials are available)
    const simulatedResponse = {
      success: true,
      reference_id: referenceId,
      status: "PROCESSING",
      utr_number: `${payment_mode}${Date.now()}`,
      transaction_date: new Date().toISOString(),
      message: `${payment_mode} transfer initiated successfully`,
    };

    // Update transaction with response
    await supabase
      .from("rbl_payment_transactions")
      .update({
        status: "processing",
        utr_number: simulatedResponse.utr_number,
        response_payload: simulatedResponse,
      })
      .eq("id", transaction.id);

    // Update disbursement record with UTR
    if (disbursement_id) {
      await supabase
        .from("loan_disbursements")
        .update({
          utr_number: simulatedResponse.utr_number,
          status: "processing",
        })
        .eq("id", disbursement_id);
    }

    console.log(`[RBL-FundTransfer] Transfer initiated: ${simulatedResponse.utr_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        reference_id: referenceId,
        utr_number: simulatedResponse.utr_number,
        status: "PROCESSING",
        message: simulatedResponse.message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RBL-FundTransfer] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
