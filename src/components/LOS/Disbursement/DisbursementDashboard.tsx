import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DisbursementForm from "./DisbursementForm";
import DisbursementStatus from "./DisbursementStatus";

interface DisbursementDashboardProps {
  applicationId: string;
}

export default function DisbursementDashboard({ applicationId }: DisbursementDashboardProps) {
  const { data: disbursement } = useQuery({
    queryKey: ["loan-disbursements", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_disbursements")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      {disbursement ? (
        <DisbursementStatus applicationId={applicationId} />
      ) : (
        <DisbursementForm applicationId={applicationId} />
      )}
    </div>
  );
}
