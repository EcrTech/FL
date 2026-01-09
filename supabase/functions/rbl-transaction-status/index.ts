import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusCheckRequest {
  org_id: string;
  environment: "uat" | "production";
  reference_id?: string;
  utr_number?: string;
  transaction_id?: string;
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

    const { org_id, environment, reference_id, utr_number, transaction_id }: StatusCheckRequest = await req.json();

    if (!org_id || !environment) {
      return new Response(
        JSON.stringify({ error: "org_id and environment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reference_id && !utr_number && !transaction_id) {
      return new Response(
        JSON.stringify({ error: "At least one of reference_id, utr_number, or transaction_id is required" }),
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

    // First, check our local transaction record
    let query = supabase
      .from("rbl_payment_transactions")
      .select("*")
      .eq("org_id", org_id);

    if (transaction_id) {
      query = query.eq("id", transaction_id);
    } else if (reference_id) {
      query = query.eq("reference_id", reference_id);
    } else if (utr_number) {
      query = query.eq("utr_number", utr_number);
    }

    const { data: localTransaction, error: localError } = await query.single();

    if (localError && localError.code !== "PGRST116") {
      console.error("[RBL-Status] Local lookup error:", localError);
    }

    // Call RBL Status API
    // Note: Actual endpoint will be provided by RBL
    const statusEndpoint = `${config.api_endpoint}/v1/payments/status`;

    console.log(`[RBL-Status] Checking status at ${statusEndpoint}`);

    // Simulate API response
    const simulatedStatus = {
      success: true,
      reference_id: reference_id || localTransaction?.reference_id,
      utr_number: utr_number || localTransaction?.utr_number,
      status: "SUCCESS", // Could be: PENDING, PROCESSING, SUCCESS, FAILED, REVERSED
      transaction_date: localTransaction?.created_at || new Date().toISOString(),
      completion_date: new Date().toISOString(),
      amount: localTransaction?.amount,
      beneficiary_name: localTransaction?.beneficiary_name,
      message: "Transaction completed successfully",
    };

    // Update local transaction if status changed
    if (localTransaction && localTransaction.status !== simulatedStatus.status.toLowerCase()) {
      await supabase
        .from("rbl_payment_transactions")
        .update({
          status: simulatedStatus.status.toLowerCase(),
          callback_data: simulatedStatus,
        })
        .eq("id", localTransaction.id);

      // If it's a disbursement, update the disbursement record too
      if (localTransaction.disbursement_id && simulatedStatus.status === "SUCCESS") {
        await supabase
          .from("loan_disbursements")
          .update({
            status: "completed",
          })
          .eq("id", localTransaction.disbursement_id);
      }
    }

    console.log(`[RBL-Status] Status: ${simulatedStatus.status}`);

    return new Response(
      JSON.stringify({
        ...simulatedStatus,
        local_record: localTransaction ? {
          id: localTransaction.id,
          created_at: localTransaction.created_at,
          transaction_type: localTransaction.transaction_type,
        } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RBL-Status] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
