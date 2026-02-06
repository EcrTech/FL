import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  const startTime = Date.now();
  console.log(`[verify-public-otp] ========== REQUEST START ==========`);
  console.log(`[verify-public-otp] Timestamp: ${new Date().toISOString()}`);
  console.log(`[verify-public-otp] Method: ${req.method}`);
  
  if (req.method === 'OPTIONS') {
    console.log(`[verify-public-otp] Handling OPTIONS preflight`);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`[verify-public-otp] Parsing request body...`);
    const body = await req.json();
    console.log(`[verify-public-otp] Request body received:`, { 
      sessionId: body.sessionId ? body.sessionId.substring(0, 8) + '...' : 'missing',
      otpLength: body.otp?.length || 0
    });
    
    const { sessionId, otp } = body;
    
    if (!sessionId || !otp) {
      console.log(`[verify-public-otp] Validation failed: missing sessionId or otp`);
      return new Response(
        JSON.stringify({ error: 'Session ID and OTP are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verify-public-otp] Initializing Supabase client...`);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    console.log(`[verify-public-otp] Supabase URL configured: ${!!supabaseUrl}`);
    console.log(`[verify-public-otp] Service role key configured: ${!!supabaseKey}`);
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[verify-public-otp] Querying OTP record at ${Date.now() - startTime}ms...`);
    const { data: otpRecord, error: fetchError } = await supabase
      .from('public_otp_verifications')
      .select('*')
      .eq('session_id', sessionId)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log(`[verify-public-otp] DB query completed at ${Date.now() - startTime}ms`);
    console.log(`[verify-public-otp] DB result:`, { 
      found: !!otpRecord, 
      fetchError: fetchError?.message || null,
      recordId: otpRecord?.id?.substring(0, 8) || null
    });

    if (fetchError || !otpRecord) {
      console.log(`[verify-public-otp] No valid OTP record found`);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verify-public-otp] OTP record details:`, {
      identifier_type: otpRecord.identifier_type,
      expires_at: otpRecord.expires_at,
      attempts: otpRecord.attempts,
      max_attempts: otpRecord.max_attempts
    });

    // Check if expired
    const isExpired = new Date(otpRecord.expires_at) < new Date();
    console.log(`[verify-public-otp] Expiry check: ${isExpired ? 'EXPIRED' : 'valid'}`);
    if (isExpired) {
      return new Response(
        JSON.stringify({ error: 'OTP has expired. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max attempts
    const maxAttemptsReached = otpRecord.attempts >= otpRecord.max_attempts;
    console.log(`[verify-public-otp] Attempts check: ${maxAttemptsReached ? 'MAX REACHED' : 'ok'}`);
    if (maxAttemptsReached) {
      return new Response(
        JSON.stringify({ error: 'Maximum attempts exceeded. Please request a new OTP.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempts
    console.log(`[verify-public-otp] Incrementing attempts...`);
    await supabase
      .from('public_otp_verifications')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id);

    // Verify OTP
    const otpMatches = otpRecord.otp_code === otp;
    console.log(`[verify-public-otp] OTP comparison: ${otpMatches ? 'MATCH' : 'NO MATCH'}`);
    
    if (!otpMatches) {
      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
      console.log(`[verify-public-otp] Invalid OTP, remaining attempts: ${remainingAttempts}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid OTP',
          remainingAttempts 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified
    console.log(`[verify-public-otp] Marking as verified...`);
    const { error: updateError } = await supabase
      .from('public_otp_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error('[verify-public-otp] Error updating verification:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verify-public-otp] OTP verified successfully for ${otpRecord.identifier_type}: ${otpRecord.identifier.substring(0, 3)}***`);
    
    const responseData = { 
      success: true, 
      verified: true,
      identifier: otpRecord.identifier,
      identifierType: otpRecord.identifier_type
    };
    console.log(`[verify-public-otp] Sending success response:`, responseData);
    console.log(`[verify-public-otp] Total execution time: ${Date.now() - startTime}ms`);
    console.log(`[verify-public-otp] ========== REQUEST END ==========`);

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[verify-public-otp] Catch block error:`, error);
    console.log(`[verify-public-otp] ========== REQUEST END (error) ==========`);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
