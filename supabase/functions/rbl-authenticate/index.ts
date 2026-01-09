import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthRequest {
  org_id: string;
  environment: "uat" | "production";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { org_id, environment }: AuthRequest = await req.json();

    if (!org_id || !environment) {
      return new Response(
        JSON.stringify({ error: "org_id and environment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch RBL config for the organization
    const { data: config, error: configError } = await supabase
      .from("rbl_bank_config")
      .select("*")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "RBL Bank configuration not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client secret from Supabase secrets
    const clientSecret = Deno.env.get(`RBL_CLIENT_SECRET_${environment.toUpperCase()}`);

    if (!config.client_id || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "RBL Bank credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call RBL Bank OAuth endpoint
    // Note: This is a placeholder - actual endpoint will be provided by RBL
    const authEndpoint = `${config.api_endpoint}/oauth/token`;

    console.log(`[RBL-Auth] Authenticating with RBL Bank at ${authEndpoint}`);

    const authResponse = await fetch(authEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.client_id,
        client_secret: clientSecret,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error(`[RBL-Auth] Authentication failed: ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with RBL Bank", details: errorText }),
        { status: authResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authData = await authResponse.json();

    console.log(`[RBL-Auth] Authentication successful, token expires in ${authData.expires_in}s`);

    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.access_token,
        token_type: authData.token_type || "Bearer",
        expires_in: authData.expires_in,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RBL-Auth] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
