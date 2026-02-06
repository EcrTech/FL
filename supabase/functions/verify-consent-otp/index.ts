import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { otpId, otp, mobile } = await req.json();
    console.log('[verify-consent-otp] Verifying OTP for:', mobile ? `XXXXX${mobile.slice(-4)}` : otpId);

    if (!otp || otp.length !== 6) {
      return new Response(
        JSON.stringify({ error: 'Valid 6-digit OTP is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find OTP record
    let query = supabase.from('consent_otp_verifications').select('*');
    
    if (otpId) {
      query = query.eq('id', otpId);
    } else if (mobile) {
      query = query.eq('mobile', mobile).is('verified_at', null).gt('expires_at', new Date().toISOString());
    }

    const { data: otpRecord, error: findError } = await query.order('created_at', { ascending: false }).limit(1).single();

    if (findError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'OTP has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (otpRecord.verified_at) {
      return new Response(
        JSON.stringify({ error: 'OTP already used' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (otpRecord.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: 'Maximum attempts exceeded. Please request a new OTP.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempts
    await supabase
      .from('consent_otp_verifications')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id);

    if (otpRecord.otp_code !== otp) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP', remainingAttempts: 4 - otpRecord.attempts }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark verified
    const { error: updateError } = await supabase
      .from('consent_otp_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    if (updateError) {
      throw new Error('Failed to verify OTP');
    }

    console.log('[verify-consent-otp] OTP verified successfully');

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        verificationId: otpRecord.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[verify-consent-otp] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
