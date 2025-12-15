import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useESignRequests(applicationId: string) {
  return useQuery({
    queryKey: ["esign-requests", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_esign_requests")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });
}

export function useESignRequestByDocument(applicationId: string, documentType: string) {
  return useQuery({
    queryKey: ["esign-request", applicationId, documentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_esign_requests")
        .select("*")
        .eq("application_id", applicationId)
        .eq("document_type", documentType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId && !!documentType,
  });
}
