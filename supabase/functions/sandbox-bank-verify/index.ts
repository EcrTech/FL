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

    const { accountNumber, ifscCode, applicationId, orgId, accessToken, verifyType = 'pennyless' } = await req.json();

    if (!accountNumber || !ifscCode || !applicationId || !orgId || !accessToken) {
      throw new Error('Missing required fields');
    }

    console.log('[Bank Verify] Verifying bank account:', accountNumber);

    // Choose the appropriate endpoint
    const endpoint = verifyType === 'pennydrop' 
      ? 'https://api.sandbox.co.in/bank/penny-drop'
      : 'https://api.sandbox.co.in/bank/account/verify';

    // Call Sandbox bank verification API
    const verifyResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': SANDBOX_API_KEY,
      },
      body: JSON.stringify({
        account_number: accountNumber,
        ifsc: ifscCode,
        consent: 'Y',
        reason: 'Loan application verification',
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('[Bank Verify] Verification failed:', errorText);
      throw new Error(`Bank verification failed: ${verifyResponse.status}`);
    }

    const verifyData = await verifyResponse.json();
    console.log('[Bank Verify] Verification response received');

    // Determine verification status
    const bankData = verifyData.data || {};
    const verificationStatus = bankData.verified ? 'verified' : 'failed';
    const accountHolderName = bankData.account_holder_name || '';
    const bankName = bankData.bank_name || '';
    const branchName = bankData.branch_name || '';

    // Save to loan_verifications table
    const { error: saveError } = await supabaseAdmin
      .from('loan_verifications')
      .insert({
        application_id: applicationId,
        org_id: orgId,
        verification_type: 'bank_account',
        verification_status: verificationStatus,
        verified_at: new Date().toISOString(),
        verified_by: user.id,
        verification_source: 'sandbox',
        request_data: { account_number: accountNumber, ifsc_code: ifscCode, verify_type: verifyType },
        response_data: verifyData,
        bank_account_number: accountNumber,
        bank_ifsc_code: ifscCode,
        bank_account_holder_name: accountHolderName,
        bank_name: bankName,
        bank_branch: branchName,
        bank_verified_status: verificationStatus,
      });

    if (saveError) {
      console.error('[Bank Verify] Error saving verification:', saveError);
      throw new Error('Failed to save verification result');
    }

    return new Response(
      JSON.stringify({
        success: true,
        verification_status: verificationStatus,
        data: {
          account_holder_name: accountHolderName,
          bank_name: bankName,
          branch_name: branchName,
          verified: bankData.verified,
          message: bankData.message,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Bank Verify] Error:', error);
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
