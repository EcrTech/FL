import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sandboxApiKey = Deno.env.get("SANDBOX_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, otp, refId } = await req.json();

    if (!token || !otp) {
      throw new Error("Token and OTP are required");
    }

    console.log("[esign-complete-sign] Verifying OTP for token");

    // Get esign request by token
    const { data: esignRequest, error: fetchError } = await supabase
      .from("document_esign_requests")
      .select(`
        *,
        application:loan_applications(
          id,
          application_number,
          applicants,
          loan_amount
        )
      `)
      .eq("access_token", token)
      .single();

    if (fetchError || !esignRequest) {
      throw new Error("Invalid or expired signing link");
    }

    // Check if token is expired
    if (new Date(esignRequest.token_expires_at) < new Date()) {
      throw new Error("This signing link has expired");
    }

    // Check if already signed
    if (esignRequest.status === 'signed') {
      throw new Error("This document has already been signed");
    }

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const actualRefId = refId || esignRequest.aadhaar_request_id;

    let verificationSuccess = false;
    let verifiedName = esignRequest.signer_name;

    // Verify OTP with Sandbox
    if (sandboxApiKey && !actualRefId?.startsWith("MOCK-")) {
      try {
        // Get access token
        const authResponse = await fetch("https://api.sandbox.co.in/authenticate", {
          method: "POST",
          headers: {
            "x-api-key": sandboxApiKey,
            "x-api-version": "2.0",
            "Content-Type": "application/json"
          }
        });

        const authData = await authResponse.json();
        if (!authData.access_token) {
          throw new Error("Failed to authenticate with verification service");
        }

        // Verify OTP
        const verifyResponse = await fetch("https://api.sandbox.co.in/kyc/aadhaar/okyc/otp/verify", {
          method: "POST",
          headers: {
            "Authorization": authData.access_token,
            "x-api-key": sandboxApiKey,
            "x-api-version": "2.0",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
            ref_id: actualRefId,
            otp: otp
          })
        });

        const verifyData = await verifyResponse.json();
        console.log("[esign-complete-sign] Verify response:", verifyData);

        if (verifyData.code === 200 || verifyData.data?.status === "VALID") {
          verificationSuccess = true;
          verifiedName = verifyData.data?.name || esignRequest.signer_name;
        } else {
          throw new Error(verifyData.message || "OTP verification failed");
        }
      } catch (verifyError: any) {
        console.error("[esign-complete-sign] Verify error:", verifyError);
        throw new Error(verifyError.message || "OTP verification failed");
      }
    } else {
      // Mock mode - accept any 6-digit OTP or "123456"
      if (otp === "123456" || /^\d{6}$/.test(otp)) {
        verificationSuccess = true;
        console.log("[esign-complete-sign] Mock mode - OTP accepted");
      } else {
        throw new Error("Invalid OTP. Please enter the 6-digit code.");
      }
    }

    if (!verificationSuccess) {
      throw new Error("OTP verification failed");
    }

    const signedAt = new Date().toISOString();

    // Update esign request
    const updatedAuditLog = [
      ...(esignRequest.audit_log || []),
      {
        action: 'signed',
        timestamp: signedAt,
        ip: clientIp,
        userAgent: userAgent,
        verifiedName: verifiedName
      }
    ];

    await supabase
      .from("document_esign_requests")
      .update({
        status: 'signed',
        signed_at: signedAt,
        signed_from_ip: clientIp,
        audit_log: updatedAuditLog
      })
      .eq("id", esignRequest.id);

    // Update the generated document if linked
    if (esignRequest.document_id) {
      await supabase
        .from("loan_generated_documents")
        .update({
          customer_signed: true,
          signed_at: signedAt
        })
        .eq("id", esignRequest.document_id);
    }

    // Also update by application and document type if no document_id
    if (!esignRequest.document_id && esignRequest.application_id) {
      await supabase
        .from("loan_generated_documents")
        .update({
          customer_signed: true,
          signed_at: signedAt
        })
        .eq("application_id", esignRequest.application_id)
        .eq("document_type", esignRequest.document_type);
    }

    console.log("[esign-complete-sign] Document signed successfully:", esignRequest.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Document signed successfully",
        signedAt: signedAt,
        signerName: verifiedName,
        documentType: esignRequest.document_type,
        applicationNumber: esignRequest.application?.application_number
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[esign-complete-sign] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
