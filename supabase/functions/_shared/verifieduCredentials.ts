import { getSupabaseClient } from './supabaseClient.ts';

// Single-tenant org ID — matches src/config/organization.ts
const DEFAULT_ORG_ID = 'a31a6056-72c8-458a-9bd8-1c43e8360095';

interface VerifiedUCredentials {
  token: string;
  companyId: string;
  baseUrl: string;
}

/**
 * Fetch VerifiedU API credentials from the organizations table using the service role key.
 * This bypasses RLS so it works for both public and authenticated edge functions.
 *
 * Falls back to environment variables if the database lookup fails or returns no credentials.
 */
export async function getVerifiedUCredentials(orgId?: string): Promise<VerifiedUCredentials | null> {
  try {
    const db = getSupabaseClient();

    const targetOrgId = orgId || DEFAULT_ORG_ID;
    const { data, error } = await db
      .from('organizations')
      .select('settings')
      .eq('id', targetOrgId)
      .limit(1)
      .single();

    if (!error && data?.settings) {
      const settings = data.settings as Record<string, string>;
      const token = settings.verifiedu_token;
      const companyId = settings.verifiedu_company_id;
      const baseUrl = settings.verifiedu_api_base_url;

      if (token && companyId && baseUrl) {
        console.log('[VerifiedU] Credentials loaded from organizations.settings');
        return { token, companyId, baseUrl };
      }
    }

    if (error) {
      console.warn('[VerifiedU] DB lookup failed:', error.message);
    }
  } catch (e) {
    console.warn('[VerifiedU] Error fetching credentials from DB:', e);
  }

  // Fall back to environment variables
  const envToken = Deno.env.get('VERIFIEDU_TOKEN');
  const envCompanyId = Deno.env.get('VERIFIEDU_COMPANY_ID');
  const envBaseUrl = Deno.env.get('VERIFIEDU_API_BASE_URL');

  if (envToken && envCompanyId && envBaseUrl) {
    console.log('[VerifiedU] Credentials loaded from environment variables');
    return { token: envToken, companyId: envCompanyId, baseUrl: envBaseUrl };
  }

  console.warn('[VerifiedU] No credentials found in DB or env vars');
  return null;
}
