import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      throw new Error('Sandbox API credentials not configured');
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('[Sandbox Auth] Authenticating with Sandbox API');

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
      console.error('[Sandbox Auth] Authentication failed:', errorText);
      throw new Error(`Sandbox authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    console.log('[Sandbox Auth] Successfully authenticated');

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
    console.error('[Sandbox Auth] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
