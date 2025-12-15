import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SanctionGenerator from "./SanctionGenerator";
import DocumentGenerator from "./DocumentGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface SanctionDashboardProps {
  applicationId: string;
  orgId: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function SanctionDashboard({ applicationId, orgId }: SanctionDashboardProps) {
  const { data: sanction, isLoading } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  // Also fetch application for additional details
  const { data: application } = useQuery({
    queryKey: ["loan-application", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Loading sanction details...</div>
        </CardContent>
      </Card>
    );
  }

  // If no sanction exists, show the generator
  if (!sanction) {
    return <SanctionGenerator applicationId={applicationId} orgId={orgId} />;
  }

  // Use correct column names from database schema
  const interestRate = sanction.sanctioned_rate || application?.interest_rate || 0;
  const tenureDays = sanction.sanctioned_tenure_days || 0;
  const tenureMonths = application?.tenure_months || Math.round(tenureDays / 30);
  
  // Parse conditions - it's JSON in the database
  const conditionsText = typeof sanction.conditions === 'string' 
    ? sanction.conditions 
    : typeof sanction.conditions === 'object' && sanction.conditions
      ? JSON.stringify(sanction.conditions, null, 2)
      : null;

  return (
    <div className="space-y-6">
      {/* Sanction Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Sanction Approved
            </CardTitle>
            <Badge variant="default" className="bg-primary">
              {sanction.sanction_number}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Sanctioned Amount</p>
              <p className="text-lg font-bold">{formatCurrency(sanction.sanctioned_amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Interest Rate</p>
              <p className="text-lg font-bold">{interestRate}% p.a.</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tenure</p>
              <p className="text-lg font-bold">{tenureDays} days</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valid Until</p>
              <p className="text-lg font-bold flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(sanction.validity_date), "dd MMM yyyy")}
              </p>
            </div>
          </div>
          
          {conditionsText && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Conditions</p>
              <p className="text-sm whitespace-pre-line">{conditionsText}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Generator */}
      <DocumentGenerator 
        applicationId={applicationId} 
        sanctionId={sanction.id} 
        orgId={orgId} 
      />
    </div>
  );
}
