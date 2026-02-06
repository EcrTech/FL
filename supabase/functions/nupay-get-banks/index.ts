import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GetBanksRequest {
  org_id: string;
  environment: "uat" | "production";
  refresh?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { org_id, environment, refresh = false }: GetBanksRequest = await req.json();

    if (!org_id || !environment) {
      return new Response(
        JSON.stringify({ error: "org_id and environment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache unless refresh requested
    if (!refresh) {
      const { data: cachedBanks, error: cacheError } = await supabase
        .from("nupay_banks")
        .select("*")
        .eq("org_id", org_id)
        .order("name", { ascending: true });

      if (!cacheError && cachedBanks && cachedBanks.length > 0) {
        // Check if cache is less than 24 hours old
        const oldestCache = cachedBanks.reduce((oldest, bank) => 
          new Date(bank.cached_at) < new Date(oldest.cached_at) ? bank : oldest
        );
        
        const cacheAge = Date.now() - new Date(oldestCache.cached_at).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        if (cacheAge < oneDayMs) {
          console.log(`[Nupay-Banks] Returning ${cachedBanks.length} cached banks`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              banks: cachedBanks,
              cached: true,
              count: cachedBanks.length 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fetch Nupay config to get endpoint - NO TOKEN NEEDED for getBankList per API spec
    const { data: config } = await supabase
      .from("nupay_config")
      .select("api_endpoint, api_key")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    console.log(`[Nupay-Banks] Config loaded:`, {
      api_endpoint: config?.api_endpoint,
      api_key_length: config?.api_key?.length || 0,
      api_key_prefix: config?.api_key?.substring(0, 8) + "...",
    });

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Nupay configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch bank list from Nupay - ONLY api-key header needed (per API spec)
    const banksEndpoint = `${config.api_endpoint}/api/EMandate/getBankList`;
    console.log(`[Nupay-Banks] Fetching bank list from ${banksEndpoint} (api-key only, no Token)`);

    const banksResponse = await fetch(banksEndpoint, {
      method: "GET",
      headers: {
        "api-key": config.api_key,
      },
    });

    if (!banksResponse.ok) {
      const errorText = await banksResponse.text();
      console.error(`[Nupay-Banks] Failed to fetch banks: ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch bank list", details: errorText }),
        { status: banksResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const banksData = await banksResponse.json();
    
    // Log full response structure for debugging
    console.log(`[Nupay-Banks] Full API response:`, JSON.stringify(banksData));
    
    // Handle various Nupay response structures
    // Actual response: {"StatusCode":"NP000","data":{"banks":[...]}}
    let banks: any[] = [];
    
    if (Array.isArray(banksData)) {
      banks = banksData;
    } else if (banksData.data?.banks && Array.isArray(banksData.data.banks)) {
      // Primary format: data.banks (confirmed from logs)
      banks = banksData.data.banks;
    } else if (banksData.data?.Banks && Array.isArray(banksData.data.Banks)) {
      banks = banksData.data.Banks;
    } else if (banksData.data && Array.isArray(banksData.data)) {
      banks = banksData.data;
    } else if (banksData.banks && Array.isArray(banksData.banks)) {
      banks = banksData.banks;
    } else if (banksData.Banks && Array.isArray(banksData.Banks)) {
      banks = banksData.Banks;
    } else if (banksData.result && Array.isArray(banksData.result)) {
      banks = banksData.result;
    }

    console.log(`[Nupay-Banks] Parsed ${banks.length} banks from response`);

    if (banks.length === 0) {
      console.warn("[Nupay-Banks] No banks found in response, returning empty array");
      return new Response(
        JSON.stringify({ 
          success: true, 
          banks: [],
          cached: false,
          count: 0,
          raw_response: banksData 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear old cache for this org
    await supabase
      .from("nupay_banks")
      .delete()
      .eq("org_id", org_id);

    // Insert new bank data - handle various field name formats
    const banksToInsert = banks.map((bank: any) => ({
      org_id,
      bank_id: bank.id || bank.Id || bank.bank_id || bank.BankId || String(bank.bankId || ""),
      name: bank.name || bank.Name || bank.bankName || bank.BankName || "Unknown",
      bank_code: bank.bank_code || bank.BankCode || bank.bankCode || bank.code || "",
      mode: bank.mode || bank.Mode || bank.authMode || "netbanking",
      is_active: true,
      cached_at: new Date().toISOString(),
    }));

    if (banksToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("nupay_banks")
        .insert(banksToInsert);

      if (insertError) {
        console.error("[Nupay-Banks] Failed to cache banks:", insertError);
      }
    }

    // Fetch the inserted banks for consistent response
    const { data: savedBanks } = await supabase
      .from("nupay_banks")
      .select("*")
      .eq("org_id", org_id)
      .order("name", { ascending: true });

    return new Response(
      JSON.stringify({ 
        success: true, 
        banks: savedBanks || banksToInsert,
        cached: false,
        count: savedBanks?.length || banksToInsert.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Nupay-Banks] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
