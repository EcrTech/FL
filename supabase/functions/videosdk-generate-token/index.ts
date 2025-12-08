import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64URL encode function
function base64UrlEncode(data: Uint8Array | string): string {
  const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create JWT manually following VideoSDK format
async function createJWT(payload: object, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  
  const data = `${headerB64}.${payloadB64}`;
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return `${data}.${signatureB64}`;
}

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

    console.log('Generating token with API key:', VIDEOSDK_API_KEY.substring(0, 10) + '...');
    console.log('Secret length:', VIDEOSDK_SECRET.length);

    // Current time in seconds
    const now = Math.floor(Date.now() / 1000);

    // JWT payload exactly as per VideoSDK documentation
    const payload = {
      apikey: VIDEOSDK_API_KEY,
      permissions: ['allow_join', 'allow_mod'],
      version: 2,
      iat: now,
      exp: now + (2 * 60 * 60) // 2 hours expiry
    };

    console.log('JWT payload:', JSON.stringify(payload));

    const token = await createJWT(payload, VIDEOSDK_SECRET);

    console.log('Generated VideoSDK token successfully, length:', token.length);
    console.log('Token preview:', token.substring(0, 50) + '...');

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
