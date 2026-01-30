import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  contactId: string;
  phoneNumber: string;
  templateId?: string;
  templateName?: string; // For hardcoded templates like "conversation"
  templateVariables?: Record<string, string>;
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== send-whatsapp-message Request Started ===');
    console.log('Request method:', req.method);
    console.log('Timestamp:', new Date().toISOString());

    // Check for Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth Header Status:', {
      present: !!authHeader,
      preview: authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING',
      length: authHeader?.length || 0
    });

    if (!authHeader) {
      throw new Error('No Authorization header provided');
    }

    // Extract JWT token (remove "Bearer " prefix)
    const token = authHeader.replace('Bearer ', '');
    console.log('Extracted JWT token (length):', token.length);

    // Create Supabase client
    console.log('Creating Supabase client with ANON_KEY...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        },
      }
    );
    console.log('✓ Supabase client created successfully');

    // Authenticate user by passing token directly to getUser()
    console.log('Attempting user authentication with JWT token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    console.log('User Auth Result:', {
      success: !!user,
      userId: user?.id || 'N/A',
      userEmail: user?.email || 'N/A',
      hasError: !!userError,
      errorCode: userError?.code || 'N/A',
      errorMessage: userError?.message || 'N/A',
      errorStatus: userError?.status || 'N/A',
    });

    if (userError) {
      console.error('Auth Error Details:', JSON.stringify(userError, null, 2));
      throw new Error(`Authentication failed: ${userError.message}`);
    }

    if (!user) {
      throw new Error('No user found in session');
    }

    console.log('✓ User authenticated:', user.email);

    const body: SendMessageRequest = await req.json();
    const { contactId, phoneNumber, templateId, templateName, templateVariables, message } = body;

    // Fetch user profile and org_id
    console.log('Fetching user profile and org_id...');
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    console.log('Profile Lookup Result:', {
      found: !!profile,
      orgId: profile?.org_id || 'N/A',
      hasError: !!profileError,
      errorMessage: profileError?.message || 'N/A'
    });

    if (profileError) {
      console.error('Profile Error:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile?.org_id) {
      throw new Error('Organization not found');
    }

    console.log('✓ Organization verified:', profile.org_id);

    // Get WhatsApp settings with Exotel credentials
    const { data: whatsappSettings } = await supabaseClient
      .from('whatsapp_settings')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .single();

    if (!whatsappSettings) {
      return new Response(JSON.stringify({ error: 'WhatsApp not configured for this organization' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate Exotel credentials
    if (!whatsappSettings.exotel_sid || !whatsappSettings.exotel_api_key || !whatsappSettings.exotel_api_token) {
      return new Response(JSON.stringify({ error: 'Exotel credentials not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let messageContent = message || '';
    let templateData = null;
    let useTemplateApi = false;

    // If using templateName (hardcoded template like "conversation"), use Exotel template API
    if (templateName) {
      useTemplateApi = true;
      // For hardcoded templates, message content is passed in the request
      messageContent = message || '';
    }
    // If using a template from database, fetch it
    else if (templateId) {
      const { data: template } = await supabaseClient
        .from('communication_templates')
        .select('*')
        .eq('id', templateId)
        .eq('org_id', profile.org_id)
        .single();

      if (!template) {
        return new Response(JSON.stringify({ error: 'Template not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      messageContent = template.content;
      
      // Replace variables in template
      if (templateVariables) {
        Object.entries(templateVariables).forEach(([key, value]) => {
          messageContent = messageContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
      }

      templateData = {
        id: template.template_id,
        params: templateVariables ? Object.values(templateVariables) : [],
      };
    }

    // Format phone number - remove non-digits for Exotel API call
    const phoneDigits = phoneNumber.replace(/[^\d]/g, '');
    // Store with + prefix for consistency with UI queries
    const phoneForStorage = '+' + phoneDigits;

    // Build Exotel API URL - ALWAYS use /messages endpoint for WhatsApp templates
    const exotelSubdomain = whatsappSettings.exotel_subdomain || 'api.exotel.com';
    const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${whatsappSettings.exotel_sid}/messages`;
    let exotelPayload: any;

    if (useTemplateApi) {
      // Use WhatsApp template API for hardcoded templates like "conversation"
      exotelPayload = {
        whatsapp: {
          messages: [{
            from: whatsappSettings.whatsapp_source_number,
            to: phoneDigits,
            content: {
              type: "template",
              template: {
                name: templateName,
                language: { code: "en" }, // "conversation" template uses "English" = "en"
                components: [] // No variables for "conversation" template
              }
            }
          }]
        }
      };
    } else {
      // Use standard messaging API for plain messages or database templates
      exotelPayload = {
        whatsapp: {
          messages: [{
            from: whatsappSettings.whatsapp_source_number,
            to: phoneDigits,
            content: {
              type: "text",
              text: messageContent
            }
          }]
        }
      };
    }

    console.log('Sending WhatsApp message via Exotel:', { 
      url: exotelUrl,
      to: phoneDigits, 
      useTemplateApi, 
      templateName: templateName || 'N/A',
      bodyLength: messageContent?.length || 0,
      payload: JSON.stringify(exotelPayload)
    });

    // Send via Exotel API
    const exotelResponse = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${whatsappSettings.exotel_api_key}:${whatsappSettings.exotel_api_token}`)}`,
      },
      body: JSON.stringify(exotelPayload),
    });

    // Read response as text first, then try to parse as JSON
    const responseText = await exotelResponse.text();
    console.log('Exotel raw response:', responseText);
    
    let exotelResult: any;
    try {
      exotelResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Exotel response as JSON:', parseError);
      // Try to extract JSON from the response if it's mixed content
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          exotelResult = JSON.parse(jsonMatch[0]);
        } catch {
          exotelResult = { raw: responseText, error: 'Invalid JSON response' };
        }
      } else {
        exotelResult = { raw: responseText, error: 'Non-JSON response' };
      }
    }
    console.log('Exotel parsed response:', exotelResult);

    if (!exotelResponse.ok) {
      // Log failed message
      await supabaseClient.from('whatsapp_messages').insert({
        org_id: profile.org_id,
        contact_id: contactId,
        template_id: templateId || null,
        sent_by: user.id,
        phone_number: phoneForStorage,
        message_content: messageContent,
        template_variables: templateVariables || null,
        status: 'failed',
        error_message: exotelResult.message || 'Failed to send message',
      });

      return new Response(
        JSON.stringify({ error: exotelResult.message || 'Failed to send message' }),
        {
          status: exotelResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log successful message
    const { data: messageRecord } = await supabaseClient
      .from('whatsapp_messages')
      .insert({
        org_id: profile.org_id,
        contact_id: contactId,
        template_id: templateId || null,
        sent_by: user.id,
        phone_number: phoneForStorage,
        message_content: messageContent,
        template_variables: templateVariables || null,
        exotel_message_id: exotelResult.sid || exotelResult.id,
        status: 'sent',
      })
      .select()
      .single();

    // Use shared service role client for wallet deduction
    const supabaseServiceClient = getSupabaseClient();

    // Deduct WhatsApp cost from wallet
    const { data: deductResult, error: deductError } = await supabaseServiceClient.rpc('deduct_from_wallet', {
      _org_id: profile.org_id,
      _amount: 1.00,
      _service_type: 'whatsapp',
      _reference_id: messageRecord?.id,
      _quantity: 1,
      _unit_cost: 1.00,
      _user_id: user.id
    });

    if (deductError || !deductResult?.success) {
      console.warn('Wallet deduction failed:', deductError || deductResult);
    }

    // Log activity
    await supabaseClient.from('contact_activities').insert({
      org_id: profile.org_id,
      contact_id: contactId,
      activity_type: 'whatsapp',
      subject: 'WhatsApp Message Sent',
      description: messageContent,
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: exotelResult.sid || exotelResult.id,
        message: messageRecord,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const err = error as Error;
    console.error('=== send-whatsapp-message Error ===');
    console.error('Error Type:', err.constructor.name);
    console.error('Error Message:', err.message);
    console.error('Error Stack:', err.stack);
    console.error('Timestamp:', new Date().toISOString());
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        status: err.message?.includes('Unauthorized') || err.message?.includes('Authentication') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
