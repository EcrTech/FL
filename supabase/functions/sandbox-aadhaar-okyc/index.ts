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

    const { operation, aadhaarNumber, otp, requestId, applicationId, orgId, accessToken } = await req.json();

    if (!operation || !orgId || !accessToken) {
      throw new Error('Missing required fields');
    }

    if (operation === 'generate-otp') {
      // Generate OTP
      if (!aadhaarNumber) {
        throw new Error('Aadhaar number is required for OTP generation');
      }

      console.log('[Aadhaar OKYC] Generating OTP for Aadhaar');

      const otpResponse = await fetch('https://api.sandbox.co.in/kyc/aadhaar/okyc/otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': SANDBOX_API_KEY,
        },
        body: JSON.stringify({
          aadhaar_number: aadhaarNumber,
          consent: 'Y',
          reason: 'Loan application verification',
        }),
      });

      if (!otpResponse.ok) {
        const errorText = await otpResponse.text();
        console.error('[Aadhaar OKYC] OTP generation failed:', errorText);
        throw new Error(`OTP generation failed: ${otpResponse.status}`);
      }

      const otpData = await otpResponse.json();
      console.log('[Aadhaar OKYC] OTP response:', JSON.stringify(otpData));

      // Check if we're in sandbox test mode (test OTP provided in response)
      const isTestMode = otpData.data?.test_otp || otpData.code === 200;
      const testOtp = otpData.data?.test_otp || null;
      
      if (isTestMode) {
        console.log('[Aadhaar OKYC] Running in TEST MODE. Test OTP may be: 123456');
      }

      return new Response(
        JSON.stringify({
          success: true,
          request_id: otpData.data?.request_id,
          message: isTestMode 
            ? 'OTP sent (Test Mode - use test OTP: 123456)' 
            : 'OTP sent to registered mobile number',
          is_test_mode: isTestMode,
          test_otp: testOtp || (isTestMode ? '123456' : null),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } else if (operation === 'verify-otp') {
      // Verify OTP
      if (!otp || !requestId || !applicationId) {
        throw new Error('OTP, request ID, and application ID are required for verification');
      }

      console.log('[Aadhaar OKYC] Verifying OTP');

      const verifyResponse = await fetch('https://api.sandbox.co.in/kyc/aadhaar/okyc/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': SANDBOX_API_KEY,
        },
        body: JSON.stringify({
          request_id: requestId,
          otp: otp,
        }),
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error('[Aadhaar OKYC] Verification failed:', errorText);
        throw new Error(`Aadhaar verification failed: ${verifyResponse.status}`);
      }

      const verifyData = await verifyResponse.json();
      console.log('[Aadhaar OKYC] Verification successful');

      const aadhaarData = verifyData.data || {};
      const verificationStatus = verifyData.data?.verified ? 'verified' : 'failed';

      // Save to loan_verifications table
      const { error: saveError } = await supabaseAdmin
        .from('loan_verifications')
        .insert({
          application_id: applicationId,
          org_id: orgId,
          verification_type: 'aadhaar',
          verification_status: verificationStatus,
          verified_at: new Date().toISOString(),
          verified_by: user.id,
          verification_source: 'sandbox',
          request_data: { request_id: requestId },
          response_data: verifyData,
          aadhaar_last4: aadhaarData.aadhaar_number?.slice(-4) || '',
          aadhaar_verified_name: aadhaarData.name || '',
          aadhaar_verified_address: aadhaarData.address?.combined || '',
          aadhaar_verified_dob: aadhaarData.dob || null,
        });

      if (saveError) {
        console.error('[Aadhaar OKYC] Error saving verification:', saveError);
        throw new Error('Failed to save verification result');
      }

      return new Response(
        JSON.stringify({
          success: true,
          verification_status: verificationStatus,
          data: {
            name: aadhaarData.name,
            dob: aadhaarData.dob,
            gender: aadhaarData.gender,
            address: aadhaarData.address,
            photo: aadhaarData.photo_link,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } else {
      throw new Error('Invalid operation. Must be "generate-otp" or "verify-otp"');
    }

  } catch (error) {
    console.error('[Aadhaar OKYC] Error:', error);
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
