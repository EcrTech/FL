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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user token
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;

    // Service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get user's org_id from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.org_id) {
      return new Response(JSON.stringify({ error: 'User profile or org not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const orgId = profile.org_id;
    const { rows } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No rows provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (rows.length > 500) {
      return new Response(JSON.stringify({ error: 'Maximum 500 rows allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const phone = (row.phone || '').trim().replace(/\D/g, '').slice(-10);
        const nameParts = (row.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || null;
        const email = row.email?.trim() || null;
        const loanAmount = parseFloat(row.loan_amount || '') || 25000;
        const source = row.source?.trim() || 'bulk_upload';

        if (!firstName || !phone) {
          results.errors.push(`Row ${i + 2}: Missing name or phone`);
          continue;
        }

        // Dedup by phone
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', orgId)
          .eq('phone', phone)
          .maybeSingle();

        let contactId: string;

        if (existing) {
          contactId = existing.id;
          results.skipped++;
        } else {
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              org_id: orgId,
              first_name: firstName,
              last_name: lastName,
              phone,
              email,
              source: 'bulk_upload',
              status: 'new',
              created_by: userId,
            })
            .select('id')
            .single();

          if (contactError) throw contactError;
          contactId = newContact.id;
        }

        const appNumber = `BLK-${Date.now()}-${i}`;
        const { error: appError } = await supabase
          .from('loan_applications')
          .insert({
            application_number: appNumber,
            org_id: orgId,
            contact_id: contactId,
            requested_amount: loanAmount,
            tenure_days: 365,
            status: 'new',
            current_stage: 'lead',
            source,
          });

        if (appError) throw appError;
        results.created++;
      } catch (err: any) {
        results.errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
