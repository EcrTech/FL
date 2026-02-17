import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DPDPConsentRecord {
  id: string;
  org_id: string;
  contact_id: string | null;
  applicant_id: string | null;
  user_identifier: string;
  consent_version: string;
  purpose: string;
  consented_at: string;
  withdrawn_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export function useDPDPConsent(orgId: string | undefined, search?: string) {
  return useQuery<DPDPConsentRecord[]>({
    queryKey: ["dpdp-consent-records", orgId, search],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      let query = supabase
        .from("dpdp_consent_records" as any)
        .select("*")
        .eq("org_id", orgId)
        .order("consented_at", { ascending: false })
        .limit(500);

      if (search) {
        query = query.ilike("user_identifier", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as DPDPConsentRecord[];
    },
    enabled: !!orgId,
  });
}
