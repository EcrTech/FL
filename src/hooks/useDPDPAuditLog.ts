import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DPDPAuditLogEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  contact_id: string | null;
  applicant_id: string | null;
  table_name: string;
  column_name: string | null;
  purpose: string | null;
  accessed_at: string;
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  tableName?: string;
}

export function useDPDPAuditLog(orgId: string | undefined, filters?: AuditLogFilters) {
  return useQuery<DPDPAuditLogEntry[]>({
    queryKey: ["dpdp-audit-log", orgId, filters],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      let query = supabase
        .from("dpdp_pii_access_log" as any)
        .select("*")
        .eq("org_id", orgId)
        .order("accessed_at", { ascending: false })
        .limit(500);

      if (filters?.startDate) {
        query = query.gte("accessed_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("accessed_at", filters.endDate);
      }
      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters?.tableName) {
        query = query.eq("table_name", filters.tableName);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as DPDPAuditLogEntry[];
    },
    enabled: !!orgId,
  });
}
