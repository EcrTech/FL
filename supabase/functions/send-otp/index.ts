import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
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
      
      // Get org's email settings for verified domain
      const { data: emailSettings } = await supabaseClient
        .from("email_settings")
        .select("sending_domain, verification_status")
        .eq("org_id", orgId)
        .single();
      
      // Use org's verified domain if available, otherwise use global verified domain
      const fromEmail = emailSettings?.verification_status === "verified" && emailSettings?.sending_domain
        ? `Paisaa Saarthi <info@${emailSettings.sending_domain}>`
        : "Paisaa Saarthi <info@paisaasaarthi.com>";
      
      console.log("Sending email from:", fromEmail, "to:", target);
      
      const emailResponse = await resend.emails.send({
        from: fromEmail,
        to: [target],
        subject: "Your Verification Code",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Paisaa Saarthi</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Secure Verification</p>
            </div>
            
            <!-- Main Content -->
            <div style="background-color: white; padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">Verify Your Email Address</h2>
              <p style="color: #6b7280; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                Please use the verification code below to confirm your email address. This helps us keep your account secure.
              </p>
              
              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); 
                          border-radius: 16px; padding: 35px; text-align: center; margin: 25px 0;
                          border: 2px dashed #cbd5e1;">
                <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
                <div style="font-size: 44px; font-weight: bold; letter-spacing: 14px; 
                            color: #1e293b; font-family: 'Courier New', Courier, monospace;
                            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;">
                  ${otp}
                </div>
              </div>
              
              <!-- Timer Notice -->
              <div style="text-align: center; margin: 30px 0;">
                <span style="background-color: #fef3c7; color: #92400e; padding: 10px 20px; 
                             border-radius: 25px; font-size: 14px; font-weight: 500;
                             display: inline-block;">
                  ⏱️ Code expires in 10 minutes
                </span>
              </div>
              
              <!-- Security Notice -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; 
                          padding: 16px 20px; margin-top: 30px; border-radius: 0 8px 8px 0;">
                <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.5;">
                  🔒 <strong>Security Notice:</strong> Never share this code with anyone. 
                  Our team will never ask for your verification code via phone or email.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">
                If you didn't request this code, you can safely ignore this email.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Paisaa Saarthi. All rights reserved.
              </p>
            </div>
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
