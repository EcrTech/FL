import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

export default function Disbursals() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Disbursals</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Disbursal Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Disbursal stage functionality coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
