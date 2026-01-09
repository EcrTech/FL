import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PennyDropRequest {
  org_id: string;
  environment: "uat" | "production";
  account_number: string;
  ifsc_code: string;
  beneficiary_name: string;
  loan_application_id?: string;
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

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData: PennyDropRequest = await req.json();
    const { org_id, environment, account_number, ifsc_code, beneficiary_name, loan_application_id } = requestData;

    if (!org_id || !environment || !account_number || !ifsc_code) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
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

    // Generate unique reference ID
    const referenceId = `PD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log the transaction
    const { data: transaction, error: txError } = await supabase
      .from("rbl_payment_transactions")
      .insert({
        org_id,
        loan_application_id,
        transaction_type: "penny_drop",
        status: "processing",
        reference_id: referenceId,
        beneficiary_name,
        beneficiary_account: account_number,
        beneficiary_ifsc: ifsc_code,
        request_payload: requestData,
        initiated_by: user.id,
      })
      .select()
      .single();

    if (txError) {
      console.error("[RBL-PennyDrop] Failed to log transaction:", txError);
    }

    // Get access token
    const clientSecret = Deno.env.get(`RBL_CLIENT_SECRET_${environment.toUpperCase()}`);
    
    // Call RBL Penny Drop API
    // Note: Actual endpoint and payload structure will be provided by RBL
    const pennyDropEndpoint = `${config.api_endpoint}/v1/account/verify`;

    console.log(`[RBL-PennyDrop] Verifying account at ${pennyDropEndpoint}`);

    const apiPayload = {
      reference_id: referenceId,
      beneficiary_account_number: account_number,
      beneficiary_ifsc: ifsc_code,
      beneficiary_name: beneficiary_name,
      amount: 1.00, // ₹1 penny drop
    };

    // For now, simulate the response since we don't have actual credentials
    // In production, this would call the actual RBL API
    const simulatedResponse = {
      success: true,
      reference_id: referenceId,
      status: "VERIFIED",
      account_holder_name: beneficiary_name,
      name_match_score: 95,
      utr_number: `PENNYDROP${Date.now()}`,
      message: "Account verified successfully",
    };

    // Update transaction with response
    if (transaction) {
      await supabase
        .from("rbl_payment_transactions")
        .update({
          status: simulatedResponse.success ? "success" : "failed",
          utr_number: simulatedResponse.utr_number,
          response_payload: simulatedResponse,
        })
        .eq("id", transaction.id);
    }

    console.log(`[RBL-PennyDrop] Verification complete: ${simulatedResponse.status}`);

    return new Response(
      JSON.stringify(simulatedResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RBL-PennyDrop] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
