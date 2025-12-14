import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier, identifierType } = await req.json();
    
    if (!identifier || !identifierType) {
      return new Response(
        JSON.stringify({ error: 'Identifier and identifierType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['email', 'phone'].includes(identifierType)) {
      return new Response(
        JSON.stringify({ error: 'identifierType must be email or phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     '0.0.0.0';

    // Check rate limiting - max 5 OTPs per identifier per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('public_otp_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('identifier_type', identifierType)
      .gte('created_at', oneHourAgo);

    if (count && count >= 5) {
      return new Response(
        JSON.stringify({ error: 'Too many OTP requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const otpCode = generateOTP();
    const sessionId = crypto.randomUUID();

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('public_otp_verifications')
      .insert({
        identifier,
        identifier_type: identifierType,
        otp_code: otpCode,
        session_id: sessionId,
        ip_address: clientIP,
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP via appropriate channel
    if (identifierType === 'email') {
      // Send email OTP using Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'noreply@paisaasaarthi.com',
            to: identifier,
            subject: 'Your OTP for Loan Application',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e3a5f;">Verify Your Email</h2>
                <p>Your OTP for loan application verification is:</p>
                <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${otpCode}</span>
                </div>
                <p style="color: #666;">This OTP is valid for 5 minutes. Do not share it with anyone.</p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Email sending failed:', await emailResponse.text());
        }
      }
    } else if (identifierType === 'phone') {
      // Send SMS OTP using MSG91 or similar service
      const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY');
      const msg91TemplateId = Deno.env.get('MSG91_OTP_TEMPLATE_ID');
      
      if (msg91AuthKey && msg91TemplateId) {
        const formattedPhone = identifier.replace(/^\+91/, '').replace(/\D/g, '');
        const smsResponse = await fetch('https://control.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authkey': msg91AuthKey,
          },
          body: JSON.stringify({
            template_id: msg91TemplateId,
            mobile: `91${formattedPhone}`,
            otp: otpCode,
          }),
        });

        if (!smsResponse.ok) {
          console.error('SMS sending failed:', await smsResponse.text());
        }
      }
    }

    console.log(`[send-public-otp] OTP sent to ${identifierType}: ${identifier.substring(0, 3)}***`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId,
        message: `OTP sent to your ${identifierType}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-public-otp:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
