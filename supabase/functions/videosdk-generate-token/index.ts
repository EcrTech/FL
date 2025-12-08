import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VIDEOSDK_API_KEY = Deno.env.get('VIDEOSDK_API_KEY');
    const VIDEOSDK_SECRET = Deno.env.get('VIDEOSDK_SECRET');

    if (!VIDEOSDK_API_KEY || !VIDEOSDK_SECRET) {
      console.error('Missing VideoSDK credentials - API_KEY present:', !!VIDEOSDK_API_KEY, 'SECRET present:', !!VIDEOSDK_SECRET);
      throw new Error('VideoSDK credentials not configured');
    }

    console.log('Generating token with API key (first 10 chars):', VIDEOSDK_API_KEY.substring(0, 10) + '...');

    // Current time in seconds
    const now = Math.floor(Date.now() / 1000);

    // JWT payload as per VideoSDK documentation
    const payload = {
      apikey: VIDEOSDK_API_KEY,
      permissions: ['allow_join', 'allow_mod'],
      version: 2,
      iat: now,
      exp: now + (2 * 60 * 60) // 2 hours expiry
    };

    // Import the secret key for HMAC signing
    const encoder = new TextEncoder();
    const keyData = encoder.encode(VIDEOSDK_SECRET);
    
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const token = await create(
      { alg: "HS256", typ: "JWT" },
      payload,
      key
    );

    console.log('Generated VideoSDK token successfully, length:', token.length);

    return new Response(
      JSON.stringify({ token }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error generating VideoSDK token:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate token' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
