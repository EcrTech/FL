import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { mobile } = await req.json();
    console.log('[send-consent-otp] Request for mobile:', mobile ? `XXXXX${mobile.slice(-4)}` : 'missing');

    if (!mobile || !/^[6-9][0-9]{9}$/.test(mobile)) {
      return new Response(
        JSON.stringify({ error: 'Valid mobile number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalidate existing OTPs
    await supabase
      .from('consent_otp_verifications')
      .update({ expires_at: new Date().toISOString() })
      .eq('mobile', mobile)
      .is('verified_at', null);

    // Create OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('consent_otp_verifications')
      .insert({
        mobile,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
        purpose: 'loan_consent',
      })
      .select()
      .single();

    if (otpError) {
      console.error('[send-consent-otp] Error creating OTP:', otpError);
      throw new Error('Failed to create OTP');
    }

    // Try to send via WhatsApp/SMS (simplified - would integrate with Gupshup/Exotel)
    console.log(`[send-consent-otp] OTP ${otp} created for ${mobile}`);

    return new Response(
      JSON.stringify({
        success: true,
        otpId: otpRecord.id,
        message: 'OTP sent to your mobile number',
        // In dev, return OTP for testing
        ...(Deno.env.get('ENVIRONMENT') !== 'production' && { devOtp: otp }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-consent-otp] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
