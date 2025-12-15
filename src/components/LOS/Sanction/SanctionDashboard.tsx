import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import SanctionGenerator from "./SanctionGenerator";
import DocumentGenerator from "./DocumentGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, FileText } from "lucide-react";
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
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
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

  // If sanction exists, show sanction summary + document generator
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
              <p className="text-lg font-bold">{sanction.interest_rate}% p.a.</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tenure</p>
              <p className="text-lg font-bold">{sanction.tenure_months} months</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valid Until</p>
              <p className="text-lg font-bold flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(sanction.valid_until), "dd MMM yyyy")}
              </p>
            </div>
          </div>
          
          {sanction.terms_and_conditions && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Terms & Conditions</p>
              <p className="text-sm whitespace-pre-line">{sanction.terms_and_conditions}</p>
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
