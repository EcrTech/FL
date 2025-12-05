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

    // Verify user
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

    const { otpId, otp, contactId, type, target } = await req.json();
    console.log("Verify OTP request:", { otpId, contactId, type });

    if (!otp || (!otpId && (!type || !target))) {
      return new Response(JSON.stringify({ error: "OTP and either otpId or type+target required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the OTP record
    let query = supabaseClient
      .from("otp_verifications")
      .select("*");

    if (otpId) {
      query = query.eq("id", otpId);
    } else {
      query = query
        .eq("target", target)
        .eq("verification_type", type)
        .is("verified_at", null)
        .gt("expires_at", new Date().toISOString());
    }

    const { data: otpRecord, error: findError } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (findError || !otpRecord) {
      console.error("OTP not found:", findError);
      return new Response(JSON.stringify({ error: "Invalid or expired OTP" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "OTP has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already verified
    if (otpRecord.verified_at) {
      return new Response(JSON.stringify({ error: "OTP already used" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return new Response(JSON.stringify({ error: "Maximum attempts exceeded. Please request a new OTP." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment attempts
    await supabaseClient
      .from("otp_verifications")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Verify OTP
    if (otpRecord.otp_code !== otp) {
      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
      return new Response(
        JSON.stringify({ 
          error: "Invalid OTP", 
          remainingAttempts 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as verified
    const verifiedAt = new Date().toISOString();
    await supabaseClient
      .from("otp_verifications")
      .update({ verified_at: verifiedAt })
      .eq("id", otpRecord.id);

    // Update contact verification status if contactId provided
    const targetContactId = contactId || otpRecord.contact_id;
    if (targetContactId) {
      const updateData = otpRecord.verification_type === "mobile"
        ? { phone_verified: true, phone_verified_at: verifiedAt }
        : { email_verified: true, email_verified_at: verifiedAt };

      const { error: updateError } = await supabaseClient
        .from("contacts")
        .update(updateData)
        .eq("id", targetContactId);

      if (updateError) {
        console.error("Error updating contact verification status:", updateError);
      }
    }

    console.log("OTP verified successfully for:", otpRecord.target);

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        verificationType: otpRecord.verification_type,
        contactId: targetContactId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-otp:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
