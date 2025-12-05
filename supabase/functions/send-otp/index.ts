import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from auth header
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, target, contactId, orgId } = await req.json();
    console.log("Send OTP request:", { type, target: target ? "***" : "missing", contactId });

    if (!type || !target || !orgId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type !== "mobile" && type !== "email") {
      return new Response(JSON.stringify({ error: "Invalid verification type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any existing OTPs for this target
    await supabaseClient
      .from("otp_verifications")
      .update({ expires_at: new Date().toISOString() })
      .eq("target", target)
      .eq("verification_type", type)
      .is("verified_at", null);

    // Create OTP record
    const { data: otpRecord, error: otpError } = await supabaseClient
      .from("otp_verifications")
      .insert({
        org_id: orgId,
        contact_id: contactId || null,
        verification_type: type,
        target: target,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (otpError) {
      console.error("Error creating OTP record:", otpError);
      return new Response(JSON.stringify({ error: "Failed to create OTP" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send OTP based on type
    if (type === "email") {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      const emailResponse = await resend.emails.send({
        from: "Verification <onboarding@resend.dev>",
        to: [target],
        subject: "Your Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Your verification code is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
            </div>
            <p style="color: #666;">This code will expire in 10 minutes.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });

      console.log("Email OTP sent:", emailResponse);
    } else if (type === "mobile") {
      // Send SMS via Exotel
      const { data: exotelSettings } = await supabaseClient
        .from("exotel_settings")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .single();

      if (!exotelSettings) {
        // Still create the OTP record but return warning
        console.warn("Exotel not configured, OTP created but not sent via SMS");
        return new Response(
          JSON.stringify({
            success: true,
            otpId: otpRecord.id,
            message: "OTP created. SMS sending not configured - OTP: " + otp, // Remove in production
            warning: "SMS provider not configured",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exotel SMS API
      const exotelSmsUrl = `https://${exotelSettings.subdomain}/v1/Accounts/${exotelSettings.account_sid}/Sms/send.json`;
      const auth = btoa(`${exotelSettings.api_key}:${exotelSettings.api_token}`);

      const smsParams = new URLSearchParams({
        From: exotelSettings.caller_id,
        To: target,
        Body: `Your verification code is: ${otp}. Valid for 10 minutes.`,
      });

      const smsResponse = await fetch(exotelSmsUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: smsParams,
      });

      if (!smsResponse.ok) {
        const errorText = await smsResponse.text();
        console.error("Exotel SMS error:", errorText);
        // Return success with warning - OTP is still valid
        return new Response(
          JSON.stringify({
            success: true,
            otpId: otpRecord.id,
            warning: "SMS delivery may have failed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("SMS OTP sent successfully");
    }

    return new Response(
      JSON.stringify({
        success: true,
        otpId: otpRecord.id,
        message: `OTP sent to ${type === "email" ? "email" : "mobile"}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-otp:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
