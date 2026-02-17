import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { DPDPStatsCards } from "@/components/DPDP/DPDPStatsCards";
import { DataRequestsPanel } from "@/components/DPDP/DataRequestsPanel";
import { BreachNotificationPanel } from "@/components/DPDP/BreachNotificationPanel";
import { PIIAuditLog } from "@/components/DPDP/PIIAuditLog";
import { ConsentRegistryPanel } from "@/components/DPDP/ConsentRegistryPanel";
import { Shield } from "lucide-react";

export default function DPDPCompliance() {
  const { orgId } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">DPDP Act Compliance</h1>
            <p className="text-muted-foreground">
              Digital Personal Data Protection Act, 2023 — Compliance Dashboard
            </p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="consents">Consent Registry</TabsTrigger>
            <TabsTrigger value="requests">Data Requests</TabsTrigger>
            <TabsTrigger value="breaches">Breach Notifications</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <DPDPStatsCards orgId={orgId} />
          </TabsContent>

          <TabsContent value="consents">
            <ConsentRegistryPanel orgId={orgId} />
          </TabsContent>

          <TabsContent value="requests">
            <DataRequestsPanel orgId={orgId} />
          </TabsContent>

          <TabsContent value="breaches">
            <BreachNotificationPanel orgId={orgId} />
          </TabsContent>

          <TabsContent value="audit">
            <PIIAuditLog orgId={orgId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
