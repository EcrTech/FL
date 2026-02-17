import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "./useNotification";

export interface DPDPDataRequest {
  id: string;
  org_id: string;
  contact_id: string | null;
  applicant_id: string | null;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  request_type: "access" | "erasure" | "correction" | "nomination" | "grievance";
  status: "pending" | "in_progress" | "completed" | "rejected";
  description: string | null;
  due_date: string;
  completed_at: string | null;
  admin_notes: string | null;
  handled_by: string | null;
  created_at: string;
}

export function useDPDPDataRequests(orgId: string | undefined) {
  const notify = useNotification();
  const queryClient = useQueryClient();

  const query = useQuery<DPDPDataRequest[]>({
    queryKey: ["dpdp-data-requests", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      const { data, error } = await supabase
        .from("dpdp_data_requests" as any)
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DPDPDataRequest[];
    },
    enabled: !!orgId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
      handled_by,
    }: {
      id: string;
      status: string;
      admin_notes?: string;
      handled_by?: string;
    }) => {
      const updateData: any = { status };
      if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
      if (handled_by) updateData.handled_by = handled_by;
      if (status === "completed") updateData.completed_at = new Date().toISOString();
      const { error } = await supabase
        .from("dpdp_data_requests" as any)
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Request updated successfully");
      queryClient.invalidateQueries({ queryKey: ["dpdp-data-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dpdp-stats"] });
    },
    onError: (error) => {
      notify.error("Failed to update request", error);
    },
  });

  return { ...query, updateStatus };
}
