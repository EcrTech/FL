import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * DigiLocker Callback Handler
 * 
 * This edge function receives POST callbacks from VerifiedU after DigiLocker verification
 * and redirects the user to the frontend React page with GET parameters.
 * 
 * Flow:
 * 1. VerifiedU POSTs to this function with callback data
 * 2. This function extracts the id and type from the request
 * 3. Returns a 302 redirect to the React success/failure page
 * 4. Browser follows redirect with GET request
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[digilocker-callback] ========== REQUEST START ==========");
  console.log("[digilocker-callback] Method:", req.method);
  console.log("[digilocker-callback] URL:", req.url);

  // Handle OPTIONS for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const lastPart = pathParts[pathParts.length - 1];
    
    // Determine if this is a success or failure callback based on path
    const isSuccess = lastPart === "success" || url.pathname.includes("success");
    const targetPath = isSuccess ? "/digilocker/success" : "/digilocker/failure";
    
    console.log("[digilocker-callback] Path:", url.pathname);
    console.log("[digilocker-callback] Is Success:", isSuccess);
    console.log("[digilocker-callback] Target Path:", targetPath);

    let id: string | null = null;
    let type: string | null = null;
    let status: string | null = null;

    // Try to extract parameters from different sources
    // VerifiedU may send data as query params, form data, or JSON body

    // 1. Check query parameters first (GET requests or POST with query params)
    id = url.searchParams.get("id");
    type = url.searchParams.get("type");
    status = url.searchParams.get("status");
    
    console.log("[digilocker-callback] Query params - id:", id, "type:", type, "status:", status);

    // 2. If POST request, try to parse body
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      console.log("[digilocker-callback] Content-Type:", contentType);
      
      const bodyText = await req.text();
      console.log("[digilocker-callback] Raw body:", bodyText);

      if (bodyText) {
        if (contentType.includes("application/json")) {
          // JSON body
          try {
            const jsonBody = JSON.parse(bodyText);
            console.log("[digilocker-callback] Parsed JSON body:", JSON.stringify(jsonBody));
            id = id || jsonBody.id || jsonBody.unique_request_number;
            type = type || jsonBody.type || "aadhaar";
            status = status || jsonBody.status;
          } catch (e) {
            console.log("[digilocker-callback] Failed to parse JSON body");
          }
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          // Form data
          try {
            const formParams = new URLSearchParams(bodyText);
            console.log("[digilocker-callback] Parsed form data:", Object.fromEntries(formParams));
            id = id || formParams.get("id") || formParams.get("unique_request_number");
            type = type || formParams.get("type") || "aadhaar";
            status = status || formParams.get("status");
          } catch (e) {
            console.log("[digilocker-callback] Failed to parse form data");
          }
        } else {
          // Try parsing as URL params anyway (common format)
          try {
            const params = new URLSearchParams(bodyText);
            if (params.has("id") || params.has("unique_request_number")) {
              console.log("[digilocker-callback] Parsed body as URL params:", Object.fromEntries(params));
              id = id || params.get("id") || params.get("unique_request_number");
              type = type || params.get("type") || "aadhaar";
              status = status || params.get("status");
            }
          } catch (e) {
            // Not URL params format
          }
        }
      }
    }

    // Default type to aadhaar if not specified
    type = type || "aadhaar";

    console.log("[digilocker-callback] Final extracted - id:", id, "type:", type, "status:", status);

    // Build the frontend redirect URL
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://ps.in-sync.co.in";
    
    // Build query string
    const queryParams = new URLSearchParams();
    if (id) queryParams.set("id", id);
    if (type) queryParams.set("type", type);
    if (status) queryParams.set("status", status);
    
    const queryString = queryParams.toString();
    const redirectUrl = `${frontendUrl}${targetPath}${queryString ? "?" + queryString : ""}`;
    
    console.log("[digilocker-callback] Redirecting to:", redirectUrl);
    console.log("[digilocker-callback] ========== REQUEST END ==========");

    // Return 302 redirect - browser will follow with GET request
    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl,
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error("[digilocker-callback] ========== ERROR ==========");
    console.error("[digilocker-callback] Error:", error instanceof Error ? error.message : String(error));
    console.error("[digilocker-callback] Stack:", error instanceof Error ? error.stack : "N/A");

    // On error, redirect to failure page
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://ps.in-sync.co.in";
    const errorRedirect = `${frontendUrl}/digilocker/failure?error=callback_failed`;
    
    return new Response(null, {
      status: 302,
      headers: {
        "Location": errorRedirect,
        ...corsHeaders,
      },
    });
  }
});
