import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileCheck, AlertTriangle, Eye, ShieldAlert } from "lucide-react";
import { useDPDPStats, DPDPStats } from "@/hooks/useDPDPStats";
import { LoadingState } from "@/components/common/LoadingState";

interface DPDPStatsCardsProps {
  orgId: string | undefined;
}

export function DPDPStatsCards({ orgId }: DPDPStatsCardsProps) {
  const { data: stats, isLoading } = useDPDPStats(orgId);

  if (isLoading) return <LoadingState />;

  const s: DPDPStats = stats || {
    total_consent_records: 0,
    active_consents: 0,
    withdrawn_consents: 0,
    pending_requests: 0,
    overdue_requests: 0,
    total_pii_accesses: 0,
    today_pii_accesses: 0,
    breach_count: 0,
  };

  const cards = [
    {
      title: "Active Consents",
      value: s.active_consents,
      subtitle: `${s.withdrawn_consents} withdrawn`,
      icon: FileCheck,
      color: "text-green-600",
    },
    {
      title: "Pending Requests",
      value: s.pending_requests,
      subtitle: s.overdue_requests > 0 ? `${s.overdue_requests} overdue!` : "All within SLA",
      icon: Shield,
      color: s.pending_requests > 0 ? "text-amber-600" : "text-green-600",
    },
    {
      title: "Overdue Requests",
      value: s.overdue_requests,
      subtitle: "Past 90-day SLA",
      icon: AlertTriangle,
      color: s.overdue_requests > 0 ? "text-red-600" : "text-green-600",
    },
    {
      title: "PII Accesses Today",
      value: s.today_pii_accesses,
      subtitle: `${s.total_pii_accesses} total`,
      icon: Eye,
      color: "text-blue-600",
    },
    {
      title: "Breach Notifications",
      value: s.breach_count,
      subtitle: "Total filed",
      icon: ShieldAlert,
      color: s.breach_count > 0 ? "text-red-600" : "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
