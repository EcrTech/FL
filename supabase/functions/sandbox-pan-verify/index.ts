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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SANDBOX_API_KEY) {
      throw new Error('Sandbox API key not configured');
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { panNumber, applicationId, orgId, accessToken } = await req.json();

    if (!panNumber || !applicationId || !orgId || !accessToken) {
      throw new Error('Missing required fields');
    }

    console.log('[PAN Verify] Verifying PAN:', panNumber);

    // Call Sandbox PAN verification API
    const verifyResponse = await fetch('https://api.sandbox.co.in/kyc/pan/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': SANDBOX_API_KEY,
      },
      body: JSON.stringify({
        pan: panNumber,
        consent: 'Y',
        reason: 'Loan application verification',
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('[PAN Verify] Verification failed:', errorText);
      throw new Error(`PAN verification failed: ${verifyResponse.status}`);
    }

    const verifyData = await verifyResponse.json();
    console.log('[PAN Verify] Verification response received');

    // Determine verification status
    const verificationStatus = verifyData.data?.valid ? 'verified' : 'failed';
    const panName = verifyData.data?.name || '';
    const panStatus = verifyData.data?.status || 'unknown';

    // Save to loan_verifications table
    const { error: saveError } = await supabaseAdmin
      .from('loan_verifications')
      .insert({
        application_id: applicationId,
        org_id: orgId,
        verification_type: 'pan',
        verification_status: verificationStatus,
        verified_at: new Date().toISOString(),
        verified_by: user.id,
        verification_source: 'sandbox',
        request_data: { pan_number: panNumber },
        response_data: verifyData,
        pan_number: panNumber,
        pan_name: panName,
        pan_status: panStatus,
      });

    if (saveError) {
      console.error('[PAN Verify] Error saving verification:', saveError);
      throw new Error('Failed to save verification result');
    }

    return new Response(
      JSON.stringify({
        success: true,
        verification_status: verificationStatus,
        data: {
          name: panName,
          status: panStatus,
          valid: verifyData.data?.valid,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[PAN Verify] Error:', error);
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
