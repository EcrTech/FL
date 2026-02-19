import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DomainRequest {
  action: 'create-domain' | 'verify-domain' | 'get-domain' | 'delete-domain';
  domain?: string;
  domainId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No Authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');

    // Anon client only for auth verification
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error(`Authentication failed: ${userError?.message || 'No user'}`);
    }

    // Service role client for all DB operations (bypasses RLS)
    const db = getSupabaseClient();

    // Get user profile and org_id
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      throw new Error(`Failed to fetch user profile: ${profileError?.message || 'No org_id'}`);
    }

    const orgId = profile.org_id;

    // Verify user is admin
    const { data: roles } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .in('role', ['admin', 'super_admin']);

    if (!roles || roles.length === 0) {
      throw new Error('Unauthorized: admin role required');
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('Resend API key not configured');
    }

    const { action, domain }: DomainRequest = await req.json();
    console.log('Action:', action, 'Org:', orgId);

    let result;

    switch (action) {
      case 'create-domain': {
        if (!domain) throw new Error('Domain is required');

        // Try creating domain on Resend
        const createResponse = await fetch('https://api.resend.com/domains', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: domain, region: 'us-east-1' }),
        });

        let resendData;

        if (!createResponse.ok) {
          // Domain may already exist — find it
          const listResponse = await fetch('https://api.resend.com/domains', {
            headers: { 'Authorization': `Bearer ${resendApiKey}` },
          });

          if (!listResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Failed to create domain: ${errorText}`);
          }

          const listData = await listResponse.json();
          const existing = (listData.data || []).find((d: any) => d.name === domain);

          if (!existing) {
            const errorText = await createResponse.text();
            throw new Error(`Failed to create domain: ${errorText}`);
          }

          // Get full details
          const detailResp = await fetch(`https://api.resend.com/domains/${existing.id}`, {
            headers: { 'Authorization': `Bearer ${resendApiKey}` },
          });
          resendData = detailResp.ok ? await detailResp.json() : existing;
        } else {
          resendData = await createResponse.json();
        }

        const status = resendData.status === 'verified' ? 'verified' : 'pending';

        // Upsert into email_settings
        const { data: existingSettings } = await db
          .from('email_settings')
          .select('id')
          .eq('org_id', orgId)
          .maybeSingle();

        const settingsPayload = {
          sending_domain: domain,
          resend_domain_id: resendData.id,
          verification_status: status,
          dns_records: resendData.records || [],
          verified_at: status === 'verified' ? new Date().toISOString() : null,
        };

        if (existingSettings) {
          const { error } = await db
            .from('email_settings')
            .update(settingsPayload)
            .eq('org_id', orgId);
          if (error) throw error;
        } else {
          const { error } = await db
            .from('email_settings')
            .insert({ org_id: orgId, ...settingsPayload });
          if (error) throw error;
        }

        result = resendData;
        break;
      }

      case 'verify-domain': {
        const { data: settings } = await db
          .from('email_settings')
          .select('resend_domain_id')
          .eq('org_id', orgId)
          .single();

        if (!settings?.resend_domain_id) throw new Error('No domain configured');

        const verifyResponse = await fetch(
          `https://api.resend.com/domains/${settings.resend_domain_id}/verify`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!verifyResponse.ok) {
          const error = await verifyResponse.text();
          throw new Error(`Failed to verify domain: ${error}`);
        }

        const verifyData = await verifyResponse.json();
        const newStatus = verifyData.status === 'verified' ? 'verified' : 'pending';

        await db
          .from('email_settings')
          .update({
            verification_status: newStatus,
            verified_at: newStatus === 'verified' ? new Date().toISOString() : null,
          })
          .eq('org_id', orgId);

        result = verifyData;
        break;
      }

      case 'get-domain': {
        const { data: settings } = await db
          .from('email_settings')
          .select('*')
          .eq('org_id', orgId)
          .maybeSingle();

        if (!settings?.resend_domain_id) {
          return new Response(
            JSON.stringify({ settings: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const getResponse = await fetch(
          `https://api.resend.com/domains/${settings.resend_domain_id}`,
          { headers: { 'Authorization': `Bearer ${resendApiKey}` } }
        );

        if (!getResponse.ok) {
          // Return DB data even if Resend API fails
          result = settings;
          break;
        }

        const domainData = await getResponse.json();

        // Sync latest status from Resend
        if (domainData.records) {
          await db
            .from('email_settings')
            .update({
              dns_records: domainData.records,
              verification_status: domainData.status || settings.verification_status,
            })
            .eq('org_id', orgId);
        }

        result = { ...settings, resendData: domainData };
        break;
      }

      case 'delete-domain': {
        const { data: settings } = await db
          .from('email_settings')
          .select('resend_domain_id')
          .eq('org_id', orgId)
          .single();

        if (!settings?.resend_domain_id) throw new Error('No domain configured');

        await fetch(
          `https://api.resend.com/domains/${settings.resend_domain_id}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${resendApiKey}` },
          }
        );

        const { error: deleteError } = await db
          .from('email_settings')
          .delete()
          .eq('org_id', orgId);

        if (deleteError) throw deleteError;
        result = { success: true };
        break;
      }

      default:
        throw new Error('Invalid action');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const err = error as Error;
    console.error('manage-resend-domain error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: err.message.includes('Authentication') || err.message.includes('Unauthorized') ? 401 : 400,
      }
    );
  }
});
