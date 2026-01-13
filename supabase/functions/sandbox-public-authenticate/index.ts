import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SANDBOX_API_KEY = Deno.env.get('SANDBOX_API_KEY');
    const SANDBOX_API_SECRET = Deno.env.get('SANDBOX_API_SECRET');

    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      console.error('[Sandbox Public Auth] API credentials not configured');
      throw new Error('Verification service not configured');
    }

    console.log('[Sandbox Public Auth] Authenticating with Sandbox API');

    // Get access token from Sandbox
    const authResponse = await fetch('https://api.sandbox.co.in/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SANDBOX_API_KEY,
        'x-api-secret': SANDBOX_API_SECRET,
      },
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[Sandbox Public Auth] Authentication failed:', authResponse.status, errorText);
      throw new Error(`Verification service authentication failed`);
    }

    const authData = await authResponse.json();
    console.log('[Sandbox Public Auth] Successfully authenticated');

    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.access_token,
        expires_in: authData.expires_in,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Sandbox Public Auth] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
