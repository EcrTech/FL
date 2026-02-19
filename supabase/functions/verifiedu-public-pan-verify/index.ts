import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getVerifiedUCredentials } from "../_shared/verifieduCredentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { panNumber } = await req.json();

    if (!panNumber) {
      return new Response(JSON.stringify({ success: false, error: "PAN number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panNumber.toUpperCase())) {
      return new Response(JSON.stringify({ success: false, error: "Invalid PAN format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch credentials server-side (bypasses RLS)
    const creds = await getVerifiedUCredentials();

    if (!creds) {
      // Mock response for testing
      return new Response(JSON.stringify({
        success: true,
        data: { name: "MOCK USER NAME", is_valid: true, dob: "1990-01-15" },
        is_mock: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch(`${creds.baseUrl}/api/verifiedu/VerifyPAN`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": creds.token, "companyid": creds.companyId },
      body: JSON.stringify({ PanNumber: panNumber.toUpperCase() }),
    });

    const responseData = await response.json();
    
    if (!response.ok || !responseData.data?.is_valid) {
      return new Response(JSON.stringify({ success: false, error: "PAN verification failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: { 
        name: responseData.data?.name, 
        is_valid: responseData.data?.is_valid,
        dob: responseData.data?.dob,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
