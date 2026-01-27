import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusRequest {
  org_id: string;
  esign_request_id?: string;
  nupay_document_id?: string;
  environment: "uat" | "production";
}

// Helper function to get Nupay auth token
// deno-lint-ignore no-explicit-any
async function getNupayToken(supabase: SupabaseClient<any, any, any>, orgId: string, environment: string): Promise<string> {
  const { data: cachedToken } = await supabase
    .from("nupay_auth_tokens")
    .select("*")
    .eq("org_id", orgId)
    .eq("environment", environment)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (cachedToken) {
    return (cachedToken as { token: string }).token;
  }

  const { data: config, error: configError } = await supabase
    .from("nupay_config")
    .select("*")
    .eq("org_id", orgId)
    .eq("environment", environment)
    .eq("is_active", true)
    .single();

  if (configError || !config) {
    throw new Error("Nupay configuration not found or inactive");
  }

  const configData = config as { api_endpoint: string; api_key: string };
  const authEndpoint = `${configData.api_endpoint}/Auth/token`;
  const authResponse = await fetch(authEndpoint, {
    method: "GET",
    headers: {
      "api-key": configData.api_key,
      "Content-Type": "application/json",
    },
  });

  if (!authResponse.ok) {
    throw new Error("Nupay auth failed");
  }

  const authData = await authResponse.json();
  const token = authData.token || authData.Token;

  if (!token) {
    throw new Error("No token received from Nupay");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 29);

  await supabase.from("nupay_auth_tokens").upsert({
    org_id: orgId,
    environment,
    token,
    expires_at: expiresAt.toISOString(),
  } as Record<string, unknown>, { onConflict: "org_id,environment" });

  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: StatusRequest = await req.json();
    const { org_id, esign_request_id, nupay_document_id, environment } = body;

    if (!org_id || !environment) {
      return new Response(
        JSON.stringify({ error: "org_id and environment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!esign_request_id && !nupay_document_id) {
      return new Response(
        JSON.stringify({ error: "Either esign_request_id or nupay_document_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch our e-sign request record
    let query = supabase
      .from("document_esign_requests")
      .select("*")
      .eq("org_id", org_id);

    if (esign_request_id) {
      query = query.eq("id", esign_request_id);
    } else if (nupay_document_id) {
      query = query.eq("nupay_document_id", nupay_document_id);
    }

    const { data: esignRecord, error: fetchError } = await query.single();

    if (fetchError || !esignRecord) {
      return new Response(
        JSON.stringify({ error: "E-sign request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already signed, return cached status
    if (esignRecord.status === "signed") {
      return new Response(
        JSON.stringify({
          success: true,
          status: "signed",
          signed_at: esignRecord.signed_at,
          esign_request_id: esignRecord.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Nupay token and config
    const token = await getNupayToken(supabase, org_id, environment);

    const { data: config } = await supabase
      .from("nupay_config")
      .select("api_endpoint")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .single();

    if (!config) {
      throw new Error("Nupay config not found");
    }

    // Call Nupay status API
    const statusEndpoint = `${config.api_endpoint}/api/SignDocument/documentStatus`;
    console.log(`[E-Sign-Status] Checking status from ${statusEndpoint}`);

    const statusResponse = await fetch(statusEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_id: esignRecord.nupay_document_id,
      }),
    });

    const responseText = await statusResponse.text();
    console.log(`[E-Sign-Status] Response: ${responseText}`);

    let statusData;
    try {
      statusData = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid status response: ${responseText}`);
    }

    if (!statusResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: statusData.message || "Status check failed",
          code: statusData.code,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse status from response
    const signerStatus = statusData.data?.signer_info?.[0]?.status || 
                         statusData.signer_info?.[0]?.status ||
                         statusData.status;

    let newStatus = esignRecord.status;
    let signedAt = null;

    if (signerStatus === "signed" || signerStatus === "completed") {
      newStatus = "signed";
      signedAt = new Date().toISOString();
    } else if (signerStatus === "expired") {
      newStatus = "expired";
    } else if (signerStatus === "failed" || signerStatus === "rejected") {
      newStatus = "failed";
    } else if (signerStatus === "viewed") {
      newStatus = "viewed";
    }

    // Update audit log
    const auditLog = Array.isArray(esignRecord.audit_log) ? esignRecord.audit_log : [];
    auditLog.push({
      action: "status_checked",
      timestamp: new Date().toISOString(),
      nupay_status: signerStatus,
      new_status: newStatus,
    });

    // Update our record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      audit_log: auditLog,
      updated_at: new Date().toISOString(),
    };

    if (signedAt) {
      updateData.signed_at = signedAt;
    }

    if (signerStatus === "viewed" && !esignRecord.viewed_at) {
      updateData.viewed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("document_esign_requests")
      .update(updateData)
      .eq("id", esignRecord.id);

    if (updateError) {
      console.error("[E-Sign-Status] Failed to update record:", updateError);
    }

    // If signed, also update loan_generated_documents
    if (newStatus === "signed" && esignRecord.document_id) {
      await supabase
        .from("loan_generated_documents")
        .update({
          customer_signed: true,
          signed_at: signedAt,
          status: "signed",
        })
        .eq("id", esignRecord.document_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        nupay_status: signerStatus,
        signed_at: signedAt,
        esign_request_id: esignRecord.id,
        signer_url: esignRecord.signer_url,
        viewed_at: updateData.viewed_at || esignRecord.viewed_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[E-Sign-Status] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
