import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TemplateButton {
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY' | 'COPY_CODE' | 'FLOW';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
  flow_id?: string;
  flow_action?: string;
  navigate_screen?: string;
}

interface ExotelComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: TemplateButton[];
}

const jsonResponse = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { templateId, orgId } = await req.json();

    if (!templateId || !orgId) {
      return jsonResponse({ success: false, error: 'Template ID and Organization ID are required' });
    }

    // Fetch template data
    const { data: template, error: templateError } = await supabaseClient
      .from('communication_templates')
      .select('*')
      .eq('id', templateId)
      .eq('org_id', orgId)
      .single();

    if (templateError || !template) {
      return jsonResponse({ success: false, error: `Template not found: ${templateError?.message}` });
    }

    // Fetch WhatsApp settings for Exotel credentials
    const { data: settings, error: settingsError } = await supabaseClient
      .from('whatsapp_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (settingsError || !settings) {
      return jsonResponse({ success: false, error: `WhatsApp settings not found: ${settingsError?.message}` });
    }

    if (!settings.exotel_sid || !settings.exotel_api_key || !settings.exotel_api_token || !settings.exotel_subdomain) {
      return jsonResponse({ success: false, error: 'Exotel credentials are not configured. Please update WhatsApp Settings.' });
    }

    if (!settings.waba_id) {
      return jsonResponse({ success: false, error: 'WABA ID is not configured. Please update WhatsApp Settings with your WhatsApp Business Account ID.' });
    }

    // Build Exotel template components
    const components: ExotelComponent[] = [];

    // Header component
    if (template.header_type && template.header_content) {
      const headerComponent: ExotelComponent = {
        type: 'HEADER',
        format: template.header_type.toUpperCase() as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT',
      };

      if (template.header_type === 'text') {
        headerComponent.text = template.header_content;
        const headerVars = template.header_content.match(/\{\{(\d+)\}\}/g);
        if (headerVars && template.sample_values?.header) {
          headerComponent.example = {
            header_text: [template.sample_values.header]
          };
        }
      } else {
        headerComponent.example = {
          header_handle: [template.header_content]
        };
      }

      components.push(headerComponent);
    }

    // Body component (required)
    const bodyComponent: ExotelComponent = {
      type: 'BODY',
      text: template.content,
    };

    const bodyVars = template.content.match(/\{\{(\d+)\}\}/g);
    if (bodyVars && template.sample_values?.body && template.sample_values.body.length > 0) {
      bodyComponent.example = {
        body_text: [template.sample_values.body]
      };
    }
    components.push(bodyComponent);

    // Footer component
    if (template.footer_text) {
      components.push({
        type: 'FOOTER',
        text: template.footer_text,
      });
    }

    // Buttons component
    if (template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0) {
      const buttonComponents: TemplateButton[] = template.buttons.map((btn: any) => {
        const button: TemplateButton = {
          type: btn.type.toUpperCase(),
          text: btn.text,
        };

        if (btn.type === 'url' || btn.type === 'URL') {
          button.url = btn.url;
          if (btn.url?.includes('{{')) {
            button.example = [btn.url.replace(/\{\{\d+\}\}/g, 'example-value')];
          }
        } else if (btn.type === 'phone_number' || btn.type === 'PHONE_NUMBER') {
          button.phone_number = btn.phone_number;
        } else if (btn.type === 'copy_code' || btn.type === 'COPY_CODE') {
          button.example = [btn.example || 'EXAMPLECODE'];
        } else if (btn.type === 'flow' || btn.type === 'FLOW') {
          button.flow_id = btn.flow_id;
          button.flow_action = btn.flow_action || 'navigate';
          if (btn.navigate_screen) {
            button.navigate_screen = btn.navigate_screen;
          }
        }

        return button;
      });

      components.push({
        type: 'BUTTONS',
        buttons: buttonComponents,
      });
    }

    // Build the Exotel API request
    const exotelPayload = {
      whatsapp: {
        templates: [{
          template: {
            category: (template.category || 'UTILITY').toUpperCase(),
            name: template.template_name,
            language: template.language || 'en',
            components: components,
          }
        }]
      }
    };

    console.log('Submitting template to Exotel:', JSON.stringify(exotelPayload, null, 2));

    // Make the API call to Exotel
    const exotelUrl = `https://${settings.exotel_subdomain}/v2/accounts/${settings.exotel_sid}/templates?waba_id=${settings.waba_id}`;
    const basicAuth = btoa(`${settings.exotel_api_key}:${settings.exotel_api_token}`);

    const exotelResponse = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify(exotelPayload),
    });

    const exotelResult = await exotelResponse.json();
    console.log('Exotel response status:', exotelResponse.status, 'body:', JSON.stringify(exotelResult, null, 2));

    if (!exotelResponse.ok) {
      const errMsg = exotelResult.message || exotelResult.error || JSON.stringify(exotelResult);
      // Update template with error status
      await supabaseClient
        .from('communication_templates')
        .update({
          submission_status: 'rejected',
          rejection_reason: errMsg,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', templateId);

      return jsonResponse({ success: false, error: `Exotel API error (${exotelResponse.status}): ${errMsg}` });
    }

    // Extract template ID from Exotel response
    const exotelTemplateId = exotelResult?.whatsapp?.templates?.[0]?.template?.id ||
                             exotelResult?.response?.templates?.[0]?.id ||
                             null;
    const exotelStatus = exotelResult?.whatsapp?.templates?.[0]?.template?.status || 'PENDING';

    // Update template with success status
    const { error: updateError } = await supabaseClient
      .from('communication_templates')
      .update({
        submission_status: 'synced',
        status: exotelStatus.toLowerCase(),
        submitted_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        template_id: exotelTemplateId || template.template_id,
      })
      .eq('id', templateId);

    if (updateError) {
      console.error('Failed to update template status:', updateError);
    }

    return jsonResponse({
      success: true,
      message: 'Template submitted to Exotel for approval',
      exotelResponse: exotelResult,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error submitting template:', error);
    return jsonResponse({ success: false, error: errorMessage });
  }
});
