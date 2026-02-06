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

    // Get auth token from header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { application_id, applicant_name, applicant_phone, applicant_email, org_id } = await req.json();

    if (!application_id || !applicant_name || !org_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: application_id, applicant_name, org_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating VideoKYC retry link for application: ${application_id}`);

    // Delete any existing failed/expired recordings for this application
    const { error: deleteError } = await supabase
      .from("videokyc_recordings")
      .delete()
      .eq("application_id", application_id)
      .in("status", ["failed", "expired", "pending"]);

    if (deleteError) {
      console.error("Error deleting old recordings:", deleteError);
    }

    // Generate a secure access token
    const accessToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    
    // Set expiry to 24 hours from now
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);

    // Create the videokyc_recordings record
    const { data: recording, error: insertError } = await supabase
      .from("videokyc_recordings")
      .insert({
        org_id,
        application_id,
        applicant_name,
        applicant_phone,
        applicant_email,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating VideoKYC recording:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create VideoKYC request", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construct the shareable URL
    const baseUrl = req.headers.get("origin") || Deno.env.get("APP_URL") || "";
    const shareableUrl = `${baseUrl}/videokyc/${accessToken}`;

    console.log(`VideoKYC retry link created successfully: ${recording.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        recording_id: recording.id,
        access_token: accessToken,
        shareable_url: shareableUrl,
        expires_at: tokenExpiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in videokyc-create-retry-link:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
