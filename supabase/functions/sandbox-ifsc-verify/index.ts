import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ifscCode, accessToken } = await req.json();
    console.log(`[IFSC-Verify] Verifying IFSC: ${ifscCode}`);

    if (!ifscCode) {
      throw new Error("IFSC code is required");
    }

    if (!accessToken) {
      throw new Error("Access token is required. Please authenticate first.");
    }

    // Call Sandbox IFSC Verification API
    const response = await fetch(`https://api.sandbox.co.in/bank/${ifscCode}`, {
      method: "GET",
      headers: {
        "Authorization": accessToken,
        "x-api-key": Deno.env.get("SANDBOX_API_KEY") || "",
        "x-api-version": "1.0",
      },
    });

    const data = await response.json();
    console.log(`[IFSC-Verify] Response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[IFSC-Verify] API error:`, data);
      throw new Error(data.message || "Failed to verify IFSC code");
    }

    console.log(`[IFSC-Verify] IFSC verified successfully:`, data);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ifsc: data.IFSC || ifscCode,
          bank_name: data.BANK,
          branch_name: data.BRANCH,
          address: data.ADDRESS,
          city: data.CITY,
          district: data.DISTRICT,
          state: data.STATE,
          micr: data.MICR,
          rtgs: data.RTGS,
          neft: data.NEFT,
          imps: data.IMPS,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[IFSC-Verify] Error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
