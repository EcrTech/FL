import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetStatusRequest {
  org_id: string;
  environment: "uat" | "production";
  mandate_id?: string;
  nupay_id?: string;
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

    const { org_id, environment, mandate_id, nupay_id }: GetStatusRequest = await req.json();

    if (!org_id || !environment) {
      return new Response(
        JSON.stringify({ error: "org_id and environment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mandate_id && !nupay_id) {
      return new Response(
        JSON.stringify({ error: "Either mandate_id or nupay_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get local mandate record
    let query = supabase
      .from("nupay_mandates")
      .select("*")
      .eq("org_id", org_id);

    if (mandate_id) {
      query = query.eq("id", mandate_id);
    } else if (nupay_id) {
      query = query.eq("nupay_id", nupay_id);
    }

    const { data: mandate, error: mandateError } = await query.single();

    if (mandateError || !mandate) {
      return new Response(
        JSON.stringify({ error: "Mandate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no nupay_id, we can't query the API
    if (!mandate.nupay_id) {
      return new Response(
        JSON.stringify({ 
          success: true,
          mandate,
          message: "Mandate not yet submitted to Nupay"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth token
    const authFunctionUrl = `${supabaseUrl}/functions/v1/nupay-authenticate`;
    const tokenResponse = await fetch(authFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ org_id, environment }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      return new Response(
        JSON.stringify({ error: "Failed to authenticate", details: errorData }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token } = await tokenResponse.json();

    // Fetch Nupay config
    const { data: config } = await supabase
      .from("nupay_config")
      .select("api_endpoint, api_key")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Nupay configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Nupay Status API
    const statusEndpoint = `${config.api_endpoint}/api/EMandate/getStatus/${mandate.nupay_id}`;
    console.log(`[Nupay-Status] Checking status at ${statusEndpoint}`);

    // Use correct headers per API spec: "Token" header (not "Authorization: Bearer")
    const statusResponse = await fetch(statusEndpoint, {
      method: "GET",
      headers: {
        "api-key": config.api_key,
        "Token": token, // Correct header per API spec
      },
    });

    const responseText = await statusResponse.text();
    let statusData;
    
    try {
      statusData = JSON.parse(responseText);
    } catch {
      console.error("[Nupay-Status] Failed to parse response:", responseText);
      statusData = { raw_response: responseText };
    }

    console.log(`[Nupay-Status] Response:`, JSON.stringify(statusData));

    // Extract customer data from nested structure
    // API returns: { StatusCode, data: { customer: { accptd, umrn, ... } } }
    const customerData = statusData.data?.customer || statusData.Data?.customer || {};
    
    // Map Nupay status to our status (check nested first, then root level)
    const nupayStatus = customerData.accptd || statusData.accptd || statusData.status || statusData.Status;
    let newStatus = mandate.status;
    
    console.log(`[Nupay-Status] Parsed status: ${nupayStatus}, customerData:`, JSON.stringify(customerData));
    
    if (nupayStatus === "accepted" || nupayStatus === "Accepted" || nupayStatus === "SUCCESS") {
      newStatus = "accepted";
    } else if (nupayStatus === "rejected" || nupayStatus === "Rejected" || nupayStatus === "FAILED") {
      newStatus = "rejected";
    } else if (nupayStatus === "pending" || nupayStatus === "Pending") {
      newStatus = "submitted";
    }

    // Extract additional fields from nested customer data (with fallback to root level)
    const umrn = customerData.umrn || customerData.UMRN || statusData.umrn || statusData.UMRN;
    const npciRef = customerData.npci_ref_no || customerData.npci_ref || statusData.npci_ref_no || statusData.npci_ref;
    const reasonCode = customerData.reason_code || statusData.reason_code || statusData.ReasonCode;
    const reasonDesc = customerData.reason_desc || statusData.reason_desc || statusData.ReasonDesc;
    const rejectedBy = customerData.reject_by || statusData.reject_by || statusData.RejectedBy;

    // Update mandate record
    const updateData: Record<string, any> = {
      status: newStatus,
      response_payload: {
        ...mandate.response_payload,
        status_check: statusData
      }
    };

    if (umrn) updateData.umrn = umrn;
    if (npciRef) updateData.npci_ref = npciRef;
    if (reasonCode) updateData.rejection_reason_code = reasonCode;
    if (reasonDesc) updateData.rejection_reason_desc = reasonDesc;
    if (rejectedBy) updateData.rejected_by = rejectedBy;

    const { error: updateError } = await supabase
      .from("nupay_mandates")
      .update(updateData)
      .eq("id", mandate.id);

    if (updateError) {
      console.error("[Nupay-Status] Failed to update mandate:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        mandate_id: mandate.id,
        nupay_id: mandate.nupay_id,
        status: newStatus,
        umrn,
        npci_ref: npciRef,
        rejection_reason_code: reasonCode,
        rejection_reason_desc: reasonDesc,
        rejected_by: rejectedBy,
        nupay_response: statusData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Nupay-Status] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
