import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ESignRequest {
  org_id: string;
  application_id: string;
  document_id: string;
  document_type: "sanction_letter" | "loan_agreement" | "daily_schedule";
  signer_name: string;
  signer_email?: string;
  signer_mobile: string;
  appearance?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  environment: "uat" | "production";
}

interface NupaySignerInfo {
  name: string;
  email?: string;
  mobile: string;
  appearance: string;
}

// Helper function to get Nupay auth token
// deno-lint-ignore no-explicit-any
async function getNupayToken(supabase: SupabaseClient<any, any, any>, orgId: string, environment: string): Promise<string> {
  // Check for cached valid token
  const { data: cachedToken } = await supabase
    .from("nupay_auth_tokens")
    .select("*")
    .eq("org_id", orgId)
    .eq("environment", environment)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (cachedToken) {
    console.log("[E-Sign] Using cached Nupay token");
    return (cachedToken as { token: string }).token;
  }

  // Get fresh token
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
  console.log(`[E-Sign] Requesting token from ${authEndpoint}`);

  const authResponse = await fetch(authEndpoint, {
    method: "GET",
    headers: {
      "api-key": configData.api_key,
      "Content-Type": "application/json",
    },
  });

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    throw new Error(`Nupay auth failed: ${errorText}`);
  }

  const authData = await authResponse.json();
  const token = authData.token || authData.Token;

  if (!token) {
    throw new Error("No token received from Nupay");
  }

  // Cache token
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

// Helper to create a simple PDF from document data
// deno-lint-ignore no-explicit-any
async function createPdfFromDocument(
  supabase: SupabaseClient<any, any, any>,
  documentId: string,
  documentType: string,
  applicationId: string
): Promise<Uint8Array> {
  // Fetch loan application and related data
  const { data: application } = await supabase
    .from("loan_applications")
    .select("*, loan_sanctions(*)")
    .eq("id", applicationId)
    .single();

  if (!application) {
    throw new Error("Application not found");
  }

  // deno-lint-ignore no-explicit-any
  const appData = application as any;

  // Create PDF using pdf-lib
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  let yPosition = height - 50;

  // Add header
  const documentTitle = documentType === "sanction_letter" ? "SANCTION LETTER" :
    documentType === "loan_agreement" ? "LOAN AGREEMENT" : "DAILY REPAYMENT SCHEDULE";

  page.drawText(documentTitle, {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= 40;

  // Add application details
  const sanction = appData.loan_sanctions?.[0];
  const lines = [
    `Application Number: ${appData.application_number || "N/A"}`,
    `Date: ${new Date().toLocaleDateString("en-IN")}`,
    "",
    `Loan Amount: Rs. ${sanction?.sanctioned_amount?.toLocaleString("en-IN") || "N/A"}`,
    `Interest Rate: ${sanction?.interest_rate || "N/A"}% p.a.`,
    `Tenure: ${sanction?.tenure_months || "N/A"} months`,
    "",
    "This document is digitally generated and requires Aadhaar-based e-signature",
    "for legal validity.",
    "",
    "",
    "",
    "Signature: ___________________________",
    "",
    "",
    "(This space is reserved for digital signature)",
  ];

  for (const line of lines) {
    if (yPosition < 50) {
      break;
    }
    page.drawText(line, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
  }

  return await pdfDoc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ESignRequest = await req.json();
    const {
      org_id,
      application_id,
      document_id,
      document_type,
      signer_name,
      signer_email,
      signer_mobile,
      appearance = "bottom-right",
      environment,
    } = body;

    // Validate required fields
    if (!org_id || !application_id || !document_type || !signer_name || !signer_mobile || !environment) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[E-Sign] Initiating e-sign for application ${application_id}, document type: ${document_type}`);

    // Get Nupay token
    const token = await getNupayToken(supabase, org_id, environment);

    // Get Nupay config for API endpoint
    const { data: config } = await supabase
      .from("nupay_config")
      .select("api_endpoint, api_key")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .single();

    if (!config) {
      throw new Error("Nupay config not found");
    }

    // Generate PDF
    console.log("[E-Sign] Generating PDF document...");
    const pdfBytes = await createPdfFromDocument(supabase, document_id, document_type, application_id);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    // Generate reference number
    const nupayRefNo = `ESIGN-${application_id.substring(0, 8).toUpperCase()}-${Date.now()}`;

    // Prepare signer info
    const signerInfo: NupaySignerInfo[] = [{
      name: signer_name,
      mobile: signer_mobile,
      appearance: appearance,
    }];

    if (signer_email) {
      signerInfo[0].email = signer_email;
    }

    // Call Nupay E-Sign API
    const esignEndpoint = `${config.api_endpoint}/api/SignDocument/signRequest`;
    console.log(`[E-Sign] Calling Nupay API: ${esignEndpoint}`);

    const esignPayload = {
      document: pdfBase64,
      no_of_signer: 1,
      signer_info: signerInfo,
      ref_no: nupayRefNo,
    };

    const esignResponse = await fetch(esignEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "api-key": config.api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(esignPayload),
    });

    const responseText = await esignResponse.text();
    console.log(`[E-Sign] Nupay response status: ${esignResponse.status}`);

    let esignData;
    try {
      esignData = JSON.parse(responseText);
    } catch {
      console.error("[E-Sign] Failed to parse response:", responseText);
      throw new Error(`Invalid response from Nupay: ${responseText}`);
    }

    if (!esignResponse.ok || esignData.code !== "NP000") {
      console.error("[E-Sign] Nupay error:", esignData);
      return new Response(
        JSON.stringify({ 
          error: esignData.message || "E-Sign request failed",
          code: esignData.code,
          details: esignData 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract response data
    const docketId = esignData.data?.docket_id || esignData.docket_id;
    const nupayDocumentId = esignData.data?.document_id || esignData.document_id;
    const signerUrl = esignData.data?.signer_url || esignData.signer_url;

    if (!signerUrl) {
      throw new Error("No signer URL in response");
    }

    // Generate access token for our record
    const accessToken = crypto.randomUUID();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 72); // 72 hour expiry

    // Create e-sign request record
    const { data: esignRecord, error: insertError } = await supabase
      .from("document_esign_requests")
      .insert({
        org_id,
        application_id,
        document_id,
        document_type,
        signer_name,
        signer_phone: signer_mobile,
        signer_email: signer_email || null,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        status: "sent",
        nupay_docket_id: docketId,
        nupay_document_id: nupayDocumentId,
        nupay_ref_no: nupayRefNo,
        signer_url: signerUrl,
        esign_response: esignData,
        notification_sent_at: new Date().toISOString(),
        audit_log: [{
          action: "esign_initiated",
          timestamp: new Date().toISOString(),
          details: { environment, appearance },
        }],
      })
      .select()
      .single();

    if (insertError) {
      console.error("[E-Sign] Failed to save record:", insertError);
      throw new Error(`Failed to save e-sign request: ${insertError.message}`);
    }

    console.log(`[E-Sign] Request created successfully: ${esignRecord.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        esign_request_id: esignRecord.id,
        signer_url: signerUrl,
        nupay_document_id: nupayDocumentId,
        ref_no: nupayRefNo,
        expires_at: tokenExpiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[E-Sign] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
