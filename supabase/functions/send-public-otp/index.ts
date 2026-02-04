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
      if (!resendApiKey) {
        console.error('RESEND_API_KEY not configured');
        return new Response(
          JSON.stringify({ error: 'Email service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[send-public-otp] Sending email OTP to: ${identifier}`);
      
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Paisaa Saarthi <info@paisaasaarthi.com>',
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
        const errorText = await emailResponse.text();
        console.error('Email sending failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to send email OTP. Please check email address.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[send-public-otp] Email OTP sent successfully to: ${identifier}`);
    } else if (identifierType === 'phone') {
      // Send WhatsApp OTP using template
      // Fetch WhatsApp settings from the first active org (system-level config for public forms)
      const { data: whatsappSettings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();
      
      let whatsappSent = false;
      if (whatsappSettings && whatsappSettings.exotel_sid && whatsappSettings.exotel_api_key && whatsappSettings.exotel_api_token) {
        const formattedPhone = identifier.replace(/^\+/, ''); // Remove leading + for Exotel
        
        // Exotel WhatsApp Template API
        const exotelSubdomain = whatsappSettings.exotel_subdomain || 'api.exotel.com';
        const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${whatsappSettings.exotel_sid}/messages`;
        
        const auth = btoa(`${whatsappSettings.exotel_api_key}:${whatsappSettings.exotel_api_token}`);
        
        // Using "psotp1" authentication template for OTP delivery
        // Template: "Your login code is {{1}}. No further action is needed..."
        // IMPORTANT: For Copy Code buttons, use "copy_code" not "url"
        const whatsappPayload = {
          whatsapp: {
            messages: [{
              from: whatsappSettings.whatsapp_source_number,
              to: formattedPhone,
              content: {
                type: 'template',
                template: {
                  name: 'psotp1',  // Authentication template with OTP variable
                  language: {
                    code: 'en_US'  // Must match template's registered language
                  },
                  components: [
                    {
                      type: 'body',
                      parameters: [{
                        type: 'text',
                        text: otpCode  // Dynamic OTP code for {{1}}
                      }]
                    },
                    {
                      type: 'button',
                      sub_type: 'url',  // Template registered with URL button type
                      index: '0',
                      parameters: [{
                        type: 'text',
                        text: otpCode  // Same OTP for "Copy code" button
                      }]
                    }
                  ]
                }
              }
            }]
          }
        };
        
        console.log(`[send-public-otp] === DEBUG INFO ===`);
        console.log(`[send-public-otp] Exotel SID: ${whatsappSettings.exotel_sid}`);
        console.log(`[send-public-otp] Exotel Subdomain: ${exotelSubdomain}`);
        console.log(`[send-public-otp] Exotel URL: ${exotelUrl}`);
        console.log(`[send-public-otp] WhatsApp Source Number: ${whatsappSettings.whatsapp_source_number}`);
        console.log(`[send-public-otp] Target Phone: ${formattedPhone}`);
        console.log(`[send-public-otp] OTP Code: ${otpCode}`);
        console.log(`[send-public-otp] Template Name: psotp1`);
        console.log(`[send-public-otp] Full Payload:`, JSON.stringify(whatsappPayload, null, 2));
        
        const whatsappResponse = await fetch(exotelUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(whatsappPayload),
        });

        const responseText = await whatsappResponse.text();
        console.log(`[send-public-otp] === RESPONSE INFO ===`);
        console.log(`[send-public-otp] HTTP Status: ${whatsappResponse.status}`);
        console.log(`[send-public-otp] Response Headers:`, JSON.stringify(Object.fromEntries(whatsappResponse.headers.entries())));
        console.log(`[send-public-otp] Raw Response: ${responseText}`);
        
        let responseData;
        try {
          responseData = JSON.parse(responseText);
          console.log(`[send-public-otp] Parsed Response:`, JSON.stringify(responseData, null, 2));
        } catch (e) {
          console.error(`[send-public-otp] Failed to parse response as JSON: ${e}`);
          responseData = { raw: responseText };
        }

        // Check for any error conditions
        const messageStatus = responseData?.response?.whatsapp?.messages?.[0];
        console.log(`[send-public-otp] Message Status:`, JSON.stringify(messageStatus));
        
        if (!whatsappResponse.ok) {
          console.error(`[send-public-otp] HTTP Error: Status ${whatsappResponse.status}`);
          console.error(`[send-public-otp] Error Details:`, responseText);
        } else if (messageStatus?.status === 'failure' || messageStatus?.error_data) {
          console.error(`[send-public-otp] WhatsApp API Error:`, JSON.stringify(messageStatus));
        } else {
          whatsappSent = true;
          console.log(`[send-public-otp] ✅ WhatsApp OTP sent successfully!`);
          console.log(`[send-public-otp] Message SID: ${messageStatus?.data?.sid || 'N/A'}`);
        }
      } else {
        console.warn('[send-public-otp] WhatsApp settings not configured:');
        console.warn(`  - exotel_sid: ${!!whatsappSettings?.exotel_sid}`);
        console.warn(`  - exotel_api_key: ${!!whatsappSettings?.exotel_api_key}`);
        console.warn(`  - exotel_api_token: ${!!whatsappSettings?.exotel_api_token}`);
      }

      // If WhatsApp not sent, log the OTP for testing and return it in response
      if (!whatsappSent) {
        console.log(`[send-public-otp] TEST MODE - OTP for ${identifier}: ${otpCode}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            sessionId,
            message: 'WhatsApp not configured - Test Mode',
            isTestMode: true,
            testOtp: otpCode 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
