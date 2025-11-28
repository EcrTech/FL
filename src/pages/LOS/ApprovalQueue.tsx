import { useOrgContext } from "@/hooks/useOrgContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import ApprovalQueue from "@/components/LOS/Approval/ApprovalQueue";
import { LoadingState } from "@/components/common/LoadingState";

export default function ApprovalQueuePage() {
  const { orgId } = useOrgContext();

  const { data: { user } = { user: null } } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const response = await supabase.auth.getUser();
      return response.data;
    },
  });

  if (!orgId || !user) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ApprovalQueue orgId={orgId} userId={user.id} />
    </DashboardLayout>
  );
}
