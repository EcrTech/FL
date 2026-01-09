import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NACHRegisterRequest {
  org_id: string;
  environment: "uat" | "production";
  loan_application_id: string;
  contact_id?: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  bank_name?: string;
  max_amount: number;
  frequency: "monthly" | "quarterly" | "half_yearly" | "yearly" | "as_presented";
  start_date: string;
  end_date?: string;
  purpose?: string;
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

    const requestData: NACHRegisterRequest = await req.json();
    const {
      org_id,
      environment,
      loan_application_id,
      contact_id,
      account_number,
      ifsc_code,
      account_holder_name,
      bank_name,
      max_amount,
      frequency,
      start_date,
      end_date,
      purpose,
    } = requestData;

    // Validate required fields
    if (!org_id || !environment || !loan_application_id || !account_number || !ifsc_code || !max_amount || !frequency || !start_date) {
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

    // Check for existing active mandate
    const { data: existingMandate } = await supabase
      .from("rbl_nach_mandates")
      .select("*")
      .eq("loan_application_id", loan_application_id)
      .in("status", ["pending", "submitted", "approved", "active"])
      .single();

    if (existingMandate) {
      return new Response(
        JSON.stringify({ 
          error: "Active mandate already exists for this loan", 
          mandate_id: existingMandate.id,
          status: existingMandate.status,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate mandate ID
    const mandateId = `NACH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create mandate record
    const { data: mandate, error: mandateError } = await supabase
      .from("rbl_nach_mandates")
      .insert({
        org_id,
        loan_application_id,
        contact_id,
        mandate_id: mandateId,
        status: "pending",
        max_amount,
        frequency,
        start_date,
        end_date,
        account_number,
        ifsc_code,
        account_holder_name,
        bank_name,
        request_payload: requestData,
        created_by: user.id,
      })
      .select()
      .single();

    if (mandateError) {
      console.error("[RBL-NACH] Failed to create mandate:", mandateError);
      return new Response(
        JSON.stringify({ error: "Failed to create mandate record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also log this as a transaction
    await supabase
      .from("rbl_payment_transactions")
      .insert({
        org_id,
        loan_application_id,
        transaction_type: "mandate_register",
        payment_mode: "NACH",
        amount: max_amount,
        status: "processing",
        reference_id: mandateId,
        beneficiary_name: account_holder_name,
        beneficiary_account: account_number,
        beneficiary_ifsc: ifsc_code,
        request_payload: requestData,
        initiated_by: user.id,
      });

    // Call RBL NACH Registration API
    // Note: Actual endpoint will be provided by RBL
    const nachEndpoint = `${config.api_endpoint}/v1/nach/mandate/register`;

    console.log(`[RBL-NACH] Registering mandate at ${nachEndpoint}`);

    const apiPayload = {
      mandate_id: mandateId,
      account_number: account_number,
      ifsc_code: ifsc_code,
      account_holder_name: account_holder_name,
      max_amount: max_amount,
      frequency: frequency.toUpperCase(),
      start_date: start_date,
      end_date: end_date,
      purpose: purpose || "Loan EMI Collection",
    };

    // Simulate API response
    const simulatedResponse = {
      success: true,
      mandate_id: mandateId,
      status: "SUBMITTED",
      message: "E-Mandate registration initiated successfully",
      registration_url: `https://emandate.rblbank.com/register/${mandateId}`, // Customer would complete mandate here
    };

    // Update mandate with response
    await supabase
      .from("rbl_nach_mandates")
      .update({
        status: "submitted",
        response_payload: simulatedResponse,
      })
      .eq("id", mandate.id);

    console.log(`[RBL-NACH] Mandate registered: ${mandateId}`);

    return new Response(
      JSON.stringify({
        success: true,
        mandate_id: mandate.id,
        rbl_mandate_id: mandateId,
        status: "SUBMITTED",
        message: simulatedResponse.message,
        registration_url: simulatedResponse.registration_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RBL-NACH] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
