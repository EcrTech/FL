import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationsTab } from "@/components/LOS/Relationships/ApplicationsTab";
import { LoansTab } from "@/components/LOS/Relationships/LoansTab";
import { ClientsTab } from "@/components/LOS/Relationships/ClientsTab";
import { FileText, Banknote, Users } from "lucide-react";

export default function CustomerRelationships() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "applications";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Relationships</h1>
          <p className="text-muted-foreground mt-1">
            View applications, loans, and customer history
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="applications" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Applications</span>
            </TabsTrigger>
            <TabsTrigger value="loans" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              <span className="hidden sm:inline">Loans</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="applications">
            <ApplicationsTab />
          </TabsContent>

          <TabsContent value="loans">
            <LoansTab />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
