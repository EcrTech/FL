import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId } = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get WhatsApp settings for this org
    const { data: settings, error: settingsError } = await supabase
      .from('whatsapp_settings')
      .select('exotel_api_key, exotel_api_token, exotel_subdomain, exotel_sid, waba_id')
      .eq('org_id', orgId)
      .single();

    if (settingsError || !settings) {
      console.error('Settings error:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp settings not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.exotel_api_key || !settings.exotel_api_token || !settings.exotel_subdomain || !settings.exotel_sid || !settings.waba_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing WhatsApp credentials. Please configure API Key, Token, Subdomain, SID, and WABA ID in WhatsApp Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Exotel API URL to fetch templates
    const exotelUrl = `https://${settings.exotel_api_key}:${settings.exotel_api_token}@${settings.exotel_subdomain}/v2/accounts/${settings.exotel_sid}/templates?waba_id=${settings.waba_id}`;

    console.info('Fetching templates from Exotel:', exotelUrl.replace(settings.exotel_api_token, '***'));

    // Fetch templates from Exotel
    const exotelResponse = await fetch(exotelUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const exotelData = await exotelResponse.json();
    console.info('Exotel response:', JSON.stringify(exotelData));

    if (!exotelResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: exotelData.message || 'Failed to fetch templates from Exotel',
          details: exotelData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract templates from response
    const templates = exotelData?.response?.whatsapp?.templates || [];
    console.info(`Found ${templates.length} templates from Exotel`);

    let updatedCount = 0;
    let addedCount = 0;

    // Update each template in database
    for (const exotelTemplate of templates) {
      const templateData = exotelTemplate.data || exotelTemplate;
      const templateName = templateData.name;
      const templateStatus = templateData.status?.toLowerCase() || 'unknown';
      const rejectedReason = templateData.rejected_reason || templateData.rejection_reason || null;

      // Map Exotel status to our status
      let mappedStatus = templateStatus;
      if (templateStatus === 'approved') {
        mappedStatus = 'approved';
      } else if (templateStatus === 'rejected') {
        mappedStatus = 'rejected';
      } else if (templateStatus === 'pending' || templateStatus === 'in_review' || templateStatus === 'submitted') {
        mappedStatus = 'pending';
      }

      // Check if template exists in our database
      const { data: existingTemplate, error: fetchError } = await supabase
        .from('communication_templates')
        .select('id, status')
        .eq('org_id', orgId)
        .eq('template_name', templateName)
        .single();

      if (existingTemplate) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('communication_templates')
          .update({
            status: mappedStatus,
            rejection_reason: rejectedReason,
            submission_status: 'synced',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', existingTemplate.id);

        if (updateError) {
          console.error(`Error updating template ${templateName}:`, updateError);
        } else {
          updatedCount++;
          console.info(`Updated template: ${templateName} -> ${mappedStatus}`);
        }
      } else {
        // Optionally add new templates from Exotel
        const { error: insertError } = await supabase
          .from('communication_templates')
          .insert({
            org_id: orgId,
            template_id: templateData.id || templateName,
            template_name: templateName,
            template_type: 'whatsapp',
            category: templateData.category || 'UTILITY',
            language: templateData.language || 'en',
            content: templateData.components?.find((c: any) => c.type === 'BODY')?.text || '',
            status: mappedStatus,
            submission_status: 'synced',
            rejection_reason: rejectedReason,
            last_synced_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Error inserting template ${templateName}:`, insertError);
        } else {
          addedCount++;
          console.info(`Added new template: ${templateName} -> ${mappedStatus}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${updatedCount} templates, added ${addedCount} new templates`,
        updatedCount,
        addedCount,
        totalFromExotel: templates.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in sync-whatsapp-templates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
