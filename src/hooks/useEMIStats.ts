import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";

export function useEMIStats() {
  const { orgId } = useOrgContext();

  return useQuery({
    queryKey: ["emi-stats", orgId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      // Total pending EMIs
      const { count: pendingEMIs } = await supabase
        .from("loan_repayment_schedule")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("status", "pending");

      // Overdue EMIs
      const { count: overdueEMIs } = await supabase
        .from("loan_repayment_schedule")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`);

      // Total paid EMIs
      const { count: paidEMIs } = await supabase
        .from("loan_repayment_schedule")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("status", "paid");

      // Upcoming EMIs (next 30 days)
      const next30Days = new Date();
      next30Days.setDate(next30Days.getDate() + 30);
      const futureDate = next30Days.toISOString().split("T")[0];

      const { data: upcomingEMIs } = await supabase
        .from("loan_repayment_schedule")
        .select(`
          *,
          loan_applications:loan_application_id(
            application_number,
            loan_applicants(first_name, last_name)
          )
        `)
        .eq("org_id", orgId!)
        .in("status", ["pending", "overdue"])
        .gte("due_date", today)
        .lte("due_date", futureDate)
        .order("due_date", { ascending: true })
        .limit(10);

      // EMI collection stats
      const { data: scheduleData } = await supabase
        .from("loan_repayment_schedule")
        .select("total_emi, amount_paid")
        .eq("org_id", orgId!);

      const totalExpected = scheduleData?.reduce((sum, item) => sum + item.total_emi, 0) || 0;
      const totalCollected = scheduleData?.reduce((sum, item) => sum + item.amount_paid, 0) || 0;

      return {
        pendingEMIs: pendingEMIs || 0,
        overdueEMIs: overdueEMIs || 0,
        paidEMIs: paidEMIs || 0,
        upcomingEMIs: upcomingEMIs || [],
        totalExpected,
        totalCollected,
        collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
      };
    },
    enabled: !!orgId,
    refetchInterval: 60000, // Refresh every minute
  });
}
