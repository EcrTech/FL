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
    const { surl, furl } = await req.json();

    if (!surl || !furl) {
      return new Response(JSON.stringify({ 
        error: "Success URL (surl) and Failure URL (furl) are required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifieduToken = Deno.env.get("VERIFIEDU_TOKEN");
    const companyId = Deno.env.get("VERIFIEDU_COMPANY_ID");
    const baseUrl = Deno.env.get("VERIFIEDU_API_BASE_URL");

    if (!verifieduToken || !companyId || !baseUrl) {
      console.log("VerifiedU credentials not configured, using mock mode");
      const mockRequestNumber = `mock_aadhaar_${Date.now()}`;
      
      return new Response(JSON.stringify({
        success: true,
        is_mock: true,
        redirect_url: `${surl}${surl.includes('?') ? '&' : '?'}id=${mockRequestNumber}&mock=true`,
        unique_request_number: mockRequestNumber,
        message: "Mock mode - redirect to success URL with mock data",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call VerifiedU API
    console.log("Calling VerifiedU API for public Aadhaar initiation");
    const response = await fetch(`${baseUrl}/api/verifiedu/VerifyAadhaarViaDigilocker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": verifieduToken,
        "companyid": companyId,
      },
      body: JSON.stringify({ surl, furl }),
    });

    const responseData = await response.json();
    console.log("VerifiedU public Aadhaar initiate response:", JSON.stringify(responseData));

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: responseData.message || "Aadhaar verification initiation failed",
        details: responseData 
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      redirect_url: responseData.data?.url,
      unique_request_number: responseData.data?.unique_request_number,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in verifiedu-public-aadhaar-initiate:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
