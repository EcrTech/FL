import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Hash, CalendarDays, IndianRupee } from "lucide-react";
import { format } from "date-fns";

interface MandateStatusCardProps {
  applicationId: string;
}

export function MandateStatusCard({ applicationId }: MandateStatusCardProps) {
  const { data: mandate } = useQuery({
    queryKey: ["nupay-mandate-status", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nupay_mandates")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  if (!mandate) return null;

  const statusColor: Record<string, string> = {
    active: "bg-green-500",
    approved: "bg-green-500",
    registered: "bg-green-500",
    pending: "bg-yellow-500",
    initiated: "bg-blue-500",
    failed: "bg-red-500",
    rejected: "bg-red-500",
    cancelled: "bg-muted",
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            NACH / eMandate
          </CardTitle>
          <Badge className={statusColor[mandate.status?.toLowerCase()] || "bg-muted"}>
            {mandate.status?.toUpperCase() || "UNKNOWN"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 md:grid-cols-3">
          {mandate.umrn && (
            <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Hash className="h-3 w-3" />
                UMRN Number
              </div>
              <div className="font-mono font-bold text-sm text-green-700 dark:text-green-400">
                {mandate.umrn}
              </div>
            </div>
          )}
          {mandate.collection_amount && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <IndianRupee className="h-3 w-3" />
                Collection Amount
              </div>
              <div className="font-bold text-sm">
                {formatCurrency(mandate.collection_amount)}
              </div>
            </div>
          )}
          {mandate.first_collection_date && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CalendarDays className="h-3 w-3" />
                Collection Date
              </div>
              <div className="font-medium text-sm">
                {format(new Date(mandate.first_collection_date), "dd MMM yyyy")}
              </div>
            </div>
          )}
        </div>
        {mandate.nupay_ref_no && (
          <div className="mt-2 text-xs text-muted-foreground">
            Ref: {mandate.nupay_ref_no}
            {mandate.bank_name && ` • Bank: ${mandate.bank_name}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
