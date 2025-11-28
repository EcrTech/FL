import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SanctionGenerator from "./SanctionGenerator";
import SanctionViewer from "./SanctionViewer";

interface SanctionDashboardProps {
  applicationId: string;
  orgId: string;
}

export default function SanctionDashboard({ applicationId, orgId }: SanctionDashboardProps) {
  const { data: sanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="space-y-6">
      {sanction ? (
        <SanctionViewer applicationId={applicationId} />
      ) : (
        <SanctionGenerator applicationId={applicationId} orgId={orgId} />
      )}
    </div>
  );
}
