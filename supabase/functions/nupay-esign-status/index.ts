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
      .select("api_endpoint, api_key")
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
        "api-key": config.api_key,
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
    const signerInfo = statusData.data?.signer_info?.[0] || statusData.signer_info?.[0];
    const signerStatus = signerInfo?.status || statusData.status;

    let newStatus = esignRecord.status;
    let signedAt = null;
    let signedDocumentPath: string | null = null;

    if (signerStatus === "signed" || signerStatus === "completed") {
      newStatus = "signed";
      signedAt = new Date().toISOString();

      // Try to download signed document from Nupay
      // Nupay may provide signed_document as base64 or a download URL
      const signedDocBase64 = statusData.data?.signed_document || 
                               statusData.signed_document ||
                               signerInfo?.signed_document;
      
      const signedDocUrl = statusData.data?.signed_document_url || 
                           statusData.signed_document_url ||
                           signerInfo?.signed_document_url ||
                           signerInfo?.download_url;

      if (signedDocBase64 || signedDocUrl) {
        try {
          let pdfBuffer: Uint8Array;

          if (signedDocBase64) {
            // Decode base64 to binary
            console.log("[E-Sign-Status] Decoding signed document from base64");
            const binaryString = atob(signedDocBase64);
            pdfBuffer = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              pdfBuffer[i] = binaryString.charCodeAt(i);
            }
          } else if (signedDocUrl) {
            // Download from URL
            console.log("[E-Sign-Status] Downloading signed document from:", signedDocUrl);
            const downloadResponse = await fetch(signedDocUrl);
            if (downloadResponse.ok) {
              const arrayBuffer = await downloadResponse.arrayBuffer();
              pdfBuffer = new Uint8Array(arrayBuffer);
            } else {
              throw new Error(`Download failed: ${downloadResponse.status}`);
            }
          } else {
            throw new Error("No signed document data available");
          }

          // Upload to Supabase Storage
          const fileName = `signed/${esignRecord.application_id}/${esignRecord.document_type}_signed_${Date.now()}.pdf`;
          console.log("[E-Sign-Status] Uploading signed PDF to storage:", fileName);

          const { error: uploadError } = await supabase.storage
            .from("loan-documents")
            .upload(fileName, pdfBuffer, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadError) {
            console.error("[E-Sign-Status] Storage upload failed:", uploadError);
          } else {
            signedDocumentPath = fileName;
            console.log("[E-Sign-Status] Signed document stored at:", signedDocumentPath);
          }
        } catch (docError) {
          console.error("[E-Sign-Status] Failed to fetch/store signed document:", docError);
        }
      } else {
        console.log("[E-Sign-Status] No signed document data in Nupay response");
      }
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
      signed_document_stored: !!signedDocumentPath,
    });

    // Update our record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      audit_log: auditLog,
      updated_at: new Date().toISOString(),
      esign_response: statusData,
    };

    if (signedAt) {
      updateData.signed_at = signedAt;
    }

    if (signedDocumentPath) {
      updateData.signed_document_path = signedDocumentPath;
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
      const docUpdateData: Record<string, unknown> = {
        customer_signed: true,
        signed_at: signedAt,
        status: "signed",
      };

      if (signedDocumentPath) {
        docUpdateData.signed_document_path = signedDocumentPath;
      }

      await supabase
        .from("loan_generated_documents")
        .update(docUpdateData)
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
