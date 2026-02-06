import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const clientReferenceId = url.searchParams.get("client_reference_id");
    const transactionId = url.searchParams.get("transaction_id");

    if (!clientReferenceId && !transactionId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "client_reference_id or transaction_id is required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get transaction from database
    let query = supabase.from("nupay_upi_transactions").select("*");
    
    if (clientReferenceId) {
      query = query.eq("client_reference_id", clientReferenceId);
    } else {
      query = query.eq("transaction_id", transactionId);
    }

    const { data: transaction, error: fetchError } = await query.single();

    if (fetchError || !transaction) {
      return new Response(
        JSON.stringify({ success: false, error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already completed, return stored status
    if (["SUCCESS", "FAILED", "REJECTED"].includes(transaction.status)) {
      return new Response(
        JSON.stringify({
          success: true,
          status: transaction.status,
          transaction,
          source: "database",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Nupay config for API call
    const { data: config } = await supabase
      .from("nupay_config")
      .select("*")
      .eq("org_id", transaction.org_id)
      .eq("is_active", true)
      .single();

    if (!config) {
      // Return database status if no active config
      return new Response(
        JSON.stringify({
          success: true,
          status: transaction.status,
          transaction,
          source: "database",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth token
    const authResponse = await fetch(`${supabaseUrl}/functions/v1/nupay-collection-authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ 
        org_id: transaction.org_id, 
        environment: config.environment 
      }),
    });

    const authData = await authResponse.json();
    if (!authData.success) {
      // Return database status if auth fails
      return new Response(
        JSON.stringify({
          success: true,
          status: transaction.status,
          transaction,
          source: "database",
          warning: "Could not verify with API",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine API endpoint
    const baseUrl = config.collection_api_endpoint || 
      (config.environment === "production" 
        ? "https://api.nupaybiz.com" 
        : "https://api-uat.nupaybiz.com");

    // Generate request ID
    const requestId = `STS-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Query Nupay API for status
    const statusResponse = await fetch(
      `${baseUrl}/collect360/v1/transactionEnquiry/${transaction.client_reference_id}`,
      {
        method: "GET",
        headers: {
          "NP-Request-ID": requestId,
          "x-api-key": config.access_key,
          "Authorization": `Bearer ${authData.token}`,
        },
      }
    );

    const statusData = await statusResponse.json();
    console.log("Status API response:", statusData);

    if (!statusResponse.ok || statusData.status_code !== "NP2000") {
      return new Response(
        JSON.stringify({
          success: true,
          status: transaction.status,
          transaction,
          source: "database",
          api_error: statusData.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update transaction if status changed
    const apiStatus = statusData.data?.transaction_status;
    if (apiStatus && apiStatus !== transaction.status) {
      const updateData: Record<string, any> = {
        status: apiStatus,
        status_description: statusData.data?.status_description,
        updated_at: new Date().toISOString(),
      };

      if (apiStatus === "SUCCESS") {
        updateData.utr = statusData.data?.utr;
        updateData.npci_transaction_id = statusData.data?.npci_transaction_id;
        updateData.payer_vpa = statusData.data?.payer_vpa;
        updateData.transaction_amount = statusData.data?.transaction_amount;
        updateData.transaction_timestamp = statusData.data?.transaction_timestamp;
      }

      const { error: updateError } = await supabase
        .from("nupay_upi_transactions")
        .update(updateData)
        .eq("id", transaction.id);

      if (updateError) {
        console.error("Failed to update transaction status:", updateError);
      }

      // If successful, trigger auto-reconciliation
      if (apiStatus === "SUCCESS" && transaction.schedule_id) {
        // Call internal reconciliation (simplified - full version in webhook)
        console.log("Payment successful, reconciliation will be handled by webhook");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: apiStatus || transaction.status,
        transaction: {
          ...transaction,
          status: apiStatus || transaction.status,
          utr: statusData.data?.utr || transaction.utr,
          payer_vpa: statusData.data?.payer_vpa || transaction.payer_vpa,
        },
        api_data: statusData.data,
        source: "api",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Status check error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
