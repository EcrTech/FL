import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DPDPStats {
  total_consent_records: number;
  active_consents: number;
  withdrawn_consents: number;
  pending_requests: number;
  overdue_requests: number;
  total_pii_accesses: number;
  today_pii_accesses: number;
  breach_count: number;
}

export function useDPDPStats(orgId: string | undefined) {
  return useQuery<DPDPStats>({
    queryKey: ["dpdp-stats", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      const { data, error } = await supabase.rpc("get_dpdp_stats", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return data as unknown as DPDPStats;
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}
