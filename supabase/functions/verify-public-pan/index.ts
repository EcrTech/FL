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

    if (!SANDBOX_API_KEY) {
      console.error('[Public PAN Verify] Sandbox API key not configured');
      throw new Error('Verification service not configured');
    }

    const { panNumber, accessToken } = await req.json();

    if (!panNumber || !accessToken) {
      console.error('[Public PAN Verify] Missing required fields:', { panNumber: !!panNumber, accessToken: !!accessToken });
      throw new Error('Missing required fields: panNumber and accessToken');
    }

    // Validate PAN format
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panNumber)) {
      throw new Error('Invalid PAN format');
    }

    console.log('[Public PAN Verify] Verifying PAN:', panNumber.substring(0, 4) + '****');

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

    const responseText = await verifyResponse.text();
    console.log('[Public PAN Verify] Response status:', verifyResponse.status);

    if (!verifyResponse.ok) {
      console.error('[Public PAN Verify] Verification failed:', responseText);
      throw new Error(`PAN verification failed: ${verifyResponse.status}`);
    }

    let verifyData;
    try {
      verifyData = JSON.parse(responseText);
    } catch (e) {
      console.error('[Public PAN Verify] Failed to parse response:', responseText);
      throw new Error('Invalid response from verification service');
    }

    console.log('[Public PAN Verify] Verification successful');

    // Extract verified data
    const isValid = verifyData.data?.valid === true;
    const panName = verifyData.data?.name || verifyData.data?.full_name || '';
    const panStatus = verifyData.data?.status || (isValid ? 'Valid' : 'Invalid');

    return new Response(
      JSON.stringify({
        success: isValid,
        name: panName,
        status: panStatus,
        message: isValid ? 'PAN verified successfully' : 'PAN verification failed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Public PAN Verify] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Verification failed',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
