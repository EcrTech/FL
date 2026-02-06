import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying VideoKYC token: ${token.substring(0, 8)}...`);

    // Find the recording by access token
    const { data: recording, error: findError } = await supabase
      .from("videokyc_recordings")
      .select("*")
      .eq("access_token", token)
      .single();

    if (findError || !recording) {
      console.error("Recording not found:", findError);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Invalid or expired link",
          status: "not_found"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(recording.token_expires_at);
    
    if (now > expiresAt) {
      // Update status to expired
      await supabase
        .from("videokyc_recordings")
        .update({ status: "expired" })
        .eq("id", recording.id);

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "This link has expired. Please request a new one.",
          status: "expired"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already completed
    if (recording.status === "completed") {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Video KYC has already been completed.",
          status: "completed",
          completed_at: recording.completed_at
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if failed (shouldn't happen since we delete failed ones)
    if (recording.status === "failed") {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "This Video KYC session has failed. Please request a new link.",
          status: "failed"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Token verified successfully for: ${recording.applicant_name}`);

    return new Response(
      JSON.stringify({
        valid: true,
        status: recording.status,
        applicant_name: recording.applicant_name,
        recording_id: recording.id,
        application_id: recording.application_id,
        org_id: recording.org_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in videokyc-verify-token:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
