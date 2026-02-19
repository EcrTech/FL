import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function safeFetch(url: string, headers: Record<string, string>) {
  try {
    const resp = await fetch(url, { headers });
    const text = await resp.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: resp.status, data: parsed };
  } catch (e) {
    return { status: 0, data: String(e) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messageSid, orgId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: settings } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (!settings) {
      return new Response(JSON.stringify({ error: 'No settings' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const auth = btoa(`${settings.exotel_api_key}:${settings.exotel_api_token}`);
    const subdomain = settings.exotel_subdomain || 'api.exotel.com';
    const authHeaders = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

    // Check specific message status
    let messageStatus = null;
    if (messageSid) {
      const statusUrl = `https://${subdomain}/v2/accounts/${settings.exotel_sid}/messages/${messageSid}`;
      messageStatus = await safeFetch(statusUrl, authHeaders);
    }

    // Get recent messages
    const recentUrl = `https://${subdomain}/v2/accounts/${settings.exotel_sid}/messages?limit=5&sort_by=date_created&order=desc`;
    const recentMessages = await safeFetch(recentUrl, authHeaders);

    return new Response(JSON.stringify({
      messageStatus,
      recentMessages,
      configuredSettings: {
        sid: settings.exotel_sid,
        subdomain,
        source: settings.whatsapp_source_number,
        waba: settings.waba_id,
      }
    }, null, 2), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
