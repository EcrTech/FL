import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  const startTime = Date.now();
  console.log("[verifiedu-public-aadhaar-initiate] ========== REQUEST START ==========");
  console.log("[verifiedu-public-aadhaar-initiate] Timestamp:", new Date().toISOString());
  console.log("[verifiedu-public-aadhaar-initiate] Method:", req.method);
  
  if (req.method === "OPTIONS") {
    console.log("[verifiedu-public-aadhaar-initiate] Handling OPTIONS preflight");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("[verifiedu-public-aadhaar-initiate] Parsing request body...");
    // Note: surl/furl from client are ignored - we use our edge function callback
    // This ensures POST callbacks from VerifiedU are properly handled
    const body = await req.json();
    
    // Extract returnUrl from request body - this is where user should be redirected after verification
    const returnUrl = body.returnUrl;
    console.log("[verifiedu-public-aadhaar-initiate] Return URL from client:", returnUrl);
    
    // Build callback URLs pointing to our edge function
    // Include returnUrl as a query param so it survives the redirect chain
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const encodedReturnUrl = returnUrl ? encodeURIComponent(returnUrl) : "";
    const returnParam = encodedReturnUrl ? `?returnUrl=${encodedReturnUrl}` : "";
    const surl = `${supabaseUrl}/functions/v1/digilocker-callback/success${returnParam}`;
    const furl = `${supabaseUrl}/functions/v1/digilocker-callback/failure${returnParam}`;
    
    console.log("[verifiedu-public-aadhaar-initiate] Using edge function callbacks:", {
      surl,
      furl,
      returnUrl,
    });

    if (!surl || !furl) {
      console.log("[verifiedu-public-aadhaar-initiate] ERROR: Missing required parameters");
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

    console.log("[verifiedu-public-aadhaar-initiate] VerifiedU credentials check:", {
      hasToken: !!verifieduToken,
      hasCompanyId: !!companyId,
      hasBaseUrl: !!baseUrl,
      baseUrl: baseUrl || "NOT SET",
    });

    if (!verifieduToken || !companyId || !baseUrl) {
      console.log("[verifiedu-public-aadhaar-initiate] Using MOCK mode - credentials not configured");
      const mockRequestNumber = `mock_aadhaar_${Date.now()}`;
      const mockRedirectUrl = `${surl}${surl.includes('?') ? '&' : '?'}id=${mockRequestNumber}&mock=true`;
      
      console.log("[verifiedu-public-aadhaar-initiate] Mock redirect URL:", mockRedirectUrl);
      console.log("[verifiedu-public-aadhaar-initiate] Total execution time:", Date.now() - startTime, "ms");
      console.log("[verifiedu-public-aadhaar-initiate] ========== REQUEST END (MOCK) ==========");
      
      return new Response(JSON.stringify({
        success: true,
        is_mock: true,
        redirect_url: mockRedirectUrl,
        unique_request_number: mockRequestNumber,
        message: "Mock mode - redirect to success URL with mock data",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call VerifiedU API
    const apiUrl = `${baseUrl}/api/verifiedu/VerifyAadhaarViaDigilocker`;
    console.log("[verifiedu-public-aadhaar-initiate] Calling VerifiedU API:", apiUrl);
    
    const apiPayload = { surl, furl };
    console.log("[verifiedu-public-aadhaar-initiate] API Payload:", JSON.stringify(apiPayload));
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": verifieduToken,
        "companyid": companyId,
      },
      body: JSON.stringify(apiPayload),
    });

    console.log("[verifiedu-public-aadhaar-initiate] API Response Status:", response.status);
    
    const responseText = await response.text();
    console.log("[verifiedu-public-aadhaar-initiate] API Raw Response:", responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error("[verifiedu-public-aadhaar-initiate] Failed to parse API response as JSON");
      return new Response(JSON.stringify({ 
        error: "Invalid response from VerifiedU API",
        raw_response: responseText.substring(0, 500),
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[verifiedu-public-aadhaar-initiate] API Parsed Response:", JSON.stringify(responseData));

    if (!response.ok) {
      console.error("[verifiedu-public-aadhaar-initiate] API returned error status:", response.status);
      return new Response(JSON.stringify({ 
        error: responseData.message || "Aadhaar verification initiation failed",
        details: responseData,
        status: response.status,
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUrl = responseData.data?.url;
    const requestNumber = responseData.data?.unique_request_number;
    
    console.log("[verifiedu-public-aadhaar-initiate] Success! Redirect URL:", redirectUrl);
    console.log("[verifiedu-public-aadhaar-initiate] Request Number:", requestNumber);
    console.log("[verifiedu-public-aadhaar-initiate] Total execution time:", Date.now() - startTime, "ms");
    console.log("[verifiedu-public-aadhaar-initiate] ========== REQUEST END ==========");

    return new Response(JSON.stringify({
      success: true,
      redirect_url: redirectUrl,
      unique_request_number: requestNumber,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[verifiedu-public-aadhaar-initiate] ========== ERROR ==========");
    console.error("[verifiedu-public-aadhaar-initiate] Error type:", error?.constructor?.name);
    console.error("[verifiedu-public-aadhaar-initiate] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[verifiedu-public-aadhaar-initiate] Error stack:", error instanceof Error ? error.stack : "N/A");
    console.log("[verifiedu-public-aadhaar-initiate] Total execution time:", Date.now() - startTime, "ms");
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal server error",
      error_type: error?.constructor?.name,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
