import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "./useNotification";

export interface DPDPBreachNotification {
  id: string;
  org_id: string;
  triggered_by: string;
  title: string;
  description: string;
  impact: string | null;
  remedial_steps: string | null;
  contact_info: string | null;
  affected_count: number;
  notified_board: boolean;
  triggered_at: string;
}

export function useDPDPBreachNotifications(orgId: string | undefined) {
  const notify = useNotification();
  const queryClient = useQueryClient();

  const query = useQuery<DPDPBreachNotification[]>({
    queryKey: ["dpdp-breach-notifications", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      const { data, error } = await supabase
        .from("dpdp_breach_notifications" as any)
        .select("*")
        .eq("org_id", orgId)
        .order("triggered_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DPDPBreachNotification[];
    },
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: async (breachData: Omit<DPDPBreachNotification, "id" | "triggered_at">) => {
      const { error } = await supabase
        .from("dpdp_breach_notifications" as any)
        .insert([breachData]);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Breach notification filed successfully");
      queryClient.invalidateQueries({ queryKey: ["dpdp-breach-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dpdp-stats"] });
    },
    onError: (error) => {
      notify.error("Failed to file breach notification", error);
    },
  });

  return { ...query, create };
}
