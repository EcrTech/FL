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

    const { token, aadhaarNumber, consent } = await req.json();

    if (!token || !aadhaarNumber) {
      throw new Error("Token and Aadhaar number are required");
    }

    if (!consent) {
      throw new Error("Consent is required to proceed with Aadhaar verification");
    }

    // Validate Aadhaar format
    const aadhaarRegex = /^\d{12}$/;
    if (!aadhaarRegex.test(aadhaarNumber)) {
      throw new Error("Invalid Aadhaar number format. Must be 12 digits.");
    }

    console.log("[esign-initiate-aadhaar] Initiating Aadhaar verification for token");

    // Get esign request by token
    const { data: esignRequest, error: fetchError } = await supabase
      .from("document_esign_requests")
      .select("*")
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
    const aadhaarLast4 = aadhaarNumber.slice(-4);

    // First, get access token from Sandbox
    let accessToken = "";
    
    if (sandboxApiKey) {
      try {
        const authResponse = await fetch("https://api.sandbox.co.in/authenticate", {
          method: "POST",
          headers: {
            "x-api-key": sandboxApiKey,
            "x-api-version": "2.0",
            "Content-Type": "application/json"
          }
        });

        const authData = await authResponse.json();
        if (authData.access_token) {
          accessToken = authData.access_token;
        } else {
          console.error("[esign-initiate-aadhaar] Auth failed:", authData);
          throw new Error("Failed to authenticate with verification service");
        }
      } catch (authError) {
        console.error("[esign-initiate-aadhaar] Auth error:", authError);
        throw new Error("Failed to connect to verification service");
      }

      // Call Sandbox OKYC to generate OTP
      try {
        const otpResponse = await fetch("https://api.sandbox.co.in/kyc/aadhaar/okyc/otp", {
          method: "POST",
          headers: {
            "Authorization": accessToken,
            "x-api-key": sandboxApiKey,
            "x-api-version": "2.0",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
            aadhaar_number: aadhaarNumber,
            consent: "y",
            reason: "Document eSign verification"
          })
        });

        const otpData = await otpResponse.json();
        console.log("[esign-initiate-aadhaar] OTP response:", otpData);

        if (otpData.code !== 200 && !otpData.data?.ref_id) {
          throw new Error(otpData.message || "Failed to send OTP");
        }

        const refId = otpData.data?.ref_id || otpData.ref_id;

        // Update esign request with Aadhaar details
        const updatedAuditLog = [
          ...(esignRequest.audit_log || []),
          {
            action: 'otp_sent',
            timestamp: new Date().toISOString(),
            aadhaarLast4,
            ip: clientIp
          }
        ];

        await supabase
          .from("document_esign_requests")
          .update({
            status: 'otp_sent',
            signer_aadhaar_last4: aadhaarLast4,
            aadhaar_request_id: refId,
            audit_log: updatedAuditLog
          })
          .eq("id", esignRequest.id);

        console.log("[esign-initiate-aadhaar] OTP sent successfully, ref_id:", refId);

        return new Response(
          JSON.stringify({
            success: true,
            message: "OTP sent to Aadhaar-linked mobile number",
            requestId: esignRequest.id,
            refId: refId
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (otpError: any) {
        console.error("[esign-initiate-aadhaar] OTP error:", otpError);
        throw new Error(otpError.message || "Failed to send OTP");
      }
    } else {
      // Sandbox API key not configured - use mock mode for testing
      console.log("[esign-initiate-aadhaar] SANDBOX_API_KEY not configured, using mock mode");
      
      const mockRefId = `MOCK-${Date.now()}`;
      
      const updatedAuditLog = [
        ...(esignRequest.audit_log || []),
        {
          action: 'otp_sent_mock',
          timestamp: new Date().toISOString(),
          aadhaarLast4,
          ip: clientIp
        }
      ];

      await supabase
        .from("document_esign_requests")
        .update({
          status: 'otp_sent',
          signer_aadhaar_last4: aadhaarLast4,
          aadhaar_request_id: mockRefId,
          audit_log: updatedAuditLog
        })
        .eq("id", esignRequest.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "OTP sent to Aadhaar-linked mobile number (Mock Mode - use 123456)",
          requestId: esignRequest.id,
          refId: mockRefId,
          mockMode: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[esign-initiate-aadhaar] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
