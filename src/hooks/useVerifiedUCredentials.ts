import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORGANIZATION_ID } from "@/config/organization";

export interface VerifiedUCredentials {
  verifieduToken: string;
  verifieduCompanyId: string;
  verifieduBaseUrl: string;
}

/**
 * Fetches VerifiedU API credentials from the organization's settings JSON.
 *
 * Expected shape in `organizations.settings`:
 * {
 *   "verifiedu_token": "...",
 *   "verifiedu_company_id": "...",
 *   "verifiedu_api_base_url": "https://..."
 * }
 */
export function useVerifiedUCredentials() {
  const query = useQuery<VerifiedUCredentials | null>({
    queryKey: ["verifiedu-credentials", ORGANIZATION_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", ORGANIZATION_ID)
        .single();

      if (error) throw error;

      const settings = data?.settings as Record<string, any> | null;
      if (
        !settings?.verifiedu_token ||
        !settings?.verifiedu_company_id ||
        !settings?.verifiedu_api_base_url
      ) {
        return null;
      }

      return {
        verifieduToken: settings.verifiedu_token,
        verifieduCompanyId: settings.verifiedu_company_id,
        verifieduBaseUrl: settings.verifiedu_api_base_url,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    credentials: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Non-hook version for use in public pages without React Query context.
 * Fetches credentials directly from Supabase.
 */
export async function fetchVerifiedUCredentials(): Promise<VerifiedUCredentials | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ORGANIZATION_ID)
    .single();

  if (error) return null;

  const settings = data?.settings as Record<string, any> | null;
  if (
    !settings?.verifiedu_token ||
    !settings?.verifiedu_company_id ||
    !settings?.verifiedu_api_base_url
  ) {
    return null;
  }

  return {
    verifieduToken: settings.verifiedu_token,
    verifieduCompanyId: settings.verifiedu_company_id,
    verifieduBaseUrl: settings.verifiedu_api_base_url,
  };
}
